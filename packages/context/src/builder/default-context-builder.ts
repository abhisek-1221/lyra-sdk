import { createChunkId, type DocumentId, type TextSpan } from "@lyra-sdk/kernel";
import { SpanChunkContentResolver, type ChunkContentResolver } from "@lyra-sdk/ingestion";
import type { ScoredChunk } from "@lyra-sdk/retrieval";
import type { Chunk, ChunkRepository, DocumentRepository, SourceDocument } from "@lyra-sdk/storage";
import type { Context, ContextChunk, ContextCitation } from "../types/index.js";
import { dedupeCitations, makeCitation } from "../citations/index.js";
import { InMemoryChunkContentResolver } from "./in-memory-chunk-content-resolver.js";
import type { ContextBuildOptions, ContextBuilder } from "./context-builder.js";
import type { Compressor, ContextOrdering, Deduplicator, Expander } from "../transform/strategies.js";
import { BudgetAllocator, CharHeuristicTokenCounter, makeTokenBudget } from "../transform/budgeting/index.js";
import type { TokenCounter } from "../transform/budgeting/index.js";
import { IdentityExpander } from "../transform/expansion/index.js";
import { DefaultDeduplicator } from "../transform/deduplication/index.js";
import { MetadataStrippingCompressor } from "../transform/compression/index.js";
import { TranscriptOrdering } from "../transform/ordering/index.js";

/**
 * Options for {@link DefaultContextBuilder}.
 *
 * The builder is composable: every strategy slot is replaceable.
 * The defaults are transcript-friendly because Lyra's primary
 * corpus is transcripts. Pure-text applications pass
 * `ScoreOrdering` and `IdentityExpander` explicitly.
 */
export interface ContextBuilderOptions {
  /** Total tokens available for the LLM call. Required. */
  readonly tokenBudget: number;
  /**
   * Reserve this many tokens for the LLM's response. Default: 0.
   */
  readonly reservedForResponse?: number;
  /** Counter for tokens. Default: `CharHeuristicTokenCounter`. */
  readonly tokenCounter?: TokenCounter;
  /**
   * Resolver for chunk text. Default: an in-memory resolver when
   * `documents` is a `Map`, or `SpanChunkContentResolver` when
   * `documents` is a `DocumentRepository`.
   */
  readonly resolver?: ChunkContentResolver;
  /**
   * Documents used for the default resolver and for citation
   * title / url lookup. A `Map` is read synchronously. A
   * `DocumentRepository` is read at build time.
   */
  readonly documents?: ReadonlyMap<string, SourceDocument> | DocumentRepository;
  /**
   * Chunk store the transcript expander reads when pulling
   * neighbors. Without it, expansion returns the retrieved set.
   */
  readonly chunkRepository?: ChunkRepository;
  /** Expander slot. Default: `IdentityExpander`. */
  readonly expander?: Expander;
  /** Deduplicator slot. Default: `DefaultDeduplicator`. */
  readonly deduplication?: Deduplicator;
  /** Ordering slot. Default: `TranscriptOrdering`. Applied after selection. */
  readonly ordering?: ContextOrdering;
  /** Compressor slot. Default: `MetadataStrippingCompressor`. */
  readonly compression?: Compressor;
  /** Default per-chunk token count. A build() option overrides this. */
  readonly countChunkTokens?: (chunk: ContextChunk, counter: TokenCounter) => number;
  /** Default extra-token count for the selected set. A build() option overrides this. */
  readonly countExtras?: (chunks: readonly ContextChunk[], counter: TokenCounter) => number;
}

type DocumentSource = ReadonlyMap<string, SourceDocument> | DocumentRepository;

/**
 * The default context builder. The chain is:
 *
 *   resolve -> expand -> dedupe -> select by score
 *     -> order -> project -> cite
 *
 * Selection runs on score order. Reading order is applied only
 * to the chunks that survived the budget, so an early timestamp
 * cannot evict a higher-scoring hit.
 */
export class DefaultContextBuilder implements ContextBuilder {
  public readonly name: string;
  private readonly tokenBudget: number;
  private readonly reservedForResponse: number;
  private readonly counter: TokenCounter;
  private readonly resolver: ChunkContentResolver;
  private readonly documents: DocumentSource | undefined;
  private readonly chunkRepository: ChunkRepository | undefined;
  private readonly expander: Expander;
  private readonly deduplication: Deduplicator;
  private readonly ordering: ContextOrdering;
  private readonly compression: Compressor;
  private readonly countChunkTokens: ContextBuilderOptions["countChunkTokens"];
  private readonly countExtras: ContextBuilderOptions["countExtras"];
  private readonly allocator: BudgetAllocator;

  constructor(options: ContextBuilderOptions) {
    if (!Number.isInteger(options.tokenBudget) || options.tokenBudget < 0) {
      throw new Error(
        `DefaultContextBuilder: tokenBudget must be a non-negative integer, got ${options.tokenBudget}`,
      );
    }
    const reservedForResponse = options.reservedForResponse ?? 0;
    if (!Number.isInteger(reservedForResponse) || reservedForResponse < 0) {
      throw new Error(
        `DefaultContextBuilder: reservedForResponse must be a non-negative integer, got ${reservedForResponse}`,
      );
    }
    if (reservedForResponse > options.tokenBudget) {
      throw new Error(
        `DefaultContextBuilder: reservedForResponse (${reservedForResponse}) cannot exceed tokenBudget (${options.tokenBudget})`,
      );
    }
    const counter = options.tokenCounter ?? new CharHeuristicTokenCounter();
    this.tokenBudget = options.tokenBudget;
    this.reservedForResponse = reservedForResponse;
    this.counter = counter;
    this.resolver = options.resolver ?? makeDefaultResolver(options.documents);
    this.documents = options.documents;
    this.chunkRepository = options.chunkRepository;
    this.ordering = options.ordering ?? new TranscriptOrdering();
    this.deduplication = options.deduplication ?? new DefaultDeduplicator();
    this.expander = options.expander ?? new IdentityExpander();
    this.compression = options.compression ?? new MetadataStrippingCompressor();
    this.countChunkTokens = options.countChunkTokens;
    this.countExtras = options.countExtras;
    this.allocator = new BudgetAllocator({
      counter,
      budget: makeTokenBudget(options.tokenBudget, reservedForResponse),
    });
    this.name = "default";
  }

  public async build(
    chunks: readonly ScoredChunk[],
    options: ContextBuildOptions = {},
  ): Promise<Context> {
    const t0 = Date.now();
    const configured = this.resolveBudget(options.tokenBudget);
    const overhead = options.promptOverheadTokens ?? 0;
    const effective = this.effectiveCap(configured, overhead);
    const queryChars = options.query?.length ?? 0;
    if (chunks.length === 0) {
      return {
        chunks: [],
        citations: [],
        usedTokens: 0,
        tokenBudget: configured,
        effectiveBudget: effective,
        truncated: false,
        diagnostics: {
          totalMs: Date.now() - t0,
          inputCount: 0,
          expandedCount: 0,
          dedupedCount: 0,
          selectedCount: 0,
          queryChars,
        },
      };
    }

    const cache = new Map<string, SourceDocument | null>();
    const tResolve = Date.now();
    const textList = await this.resolver.resolveMany(chunks.map((c) => c.chunk));
    const resolveMs = Date.now() - tResolve;

    const tMake = Date.now();
    const initial: ContextChunk[] = [];
    for (let i = 0; i < chunks.length; i++) {
      const scored = chunks[i]!;
      const text = textList[i] ?? "";
      if (text.length === 0) continue;
      initial.push(await this.makeChunk(scored.chunk, text, scored.score, scored.embedding, cache));
    }
    const makeMs = Date.now() - tMake;

    const tChain = Date.now();
    const expanded = await this.expander.expand(initial, {
      ...(this.chunkRepository !== undefined ? { chunkRepository: this.chunkRepository } : {}),
      toContextChunk: async (chunk, score) => {
        const text = await this.resolver.resolve(chunk);
        if (text.length === 0) return undefined;
        return this.makeChunk(chunk, text, score, undefined, cache);
      },
    });
    const deduped = await this.deduplication.deduplicate(expanded, {
      resolveSpan: (documentId, span) => this.resolveSpan(documentId, span),
    });

    const countChunk = options.countChunkTokens ?? this.countChunkTokens ?? ((chunk, counter) => counter.count(chunk.text));
    const count = (chunk: ContextChunk) => countChunk(chunk, this.counter);
    const extraFn = options.countExtras ?? this.countExtras;
    const extras = (selected: readonly ContextChunk[]) =>
      extraFn !== undefined ? extraFn(selected, this.counter) : 0;
    const joinTokens = options.joinWith !== undefined ? this.counter.count(options.joinWith) : 0;

    const allocated = this.allocator.allocate(deduped, { cap: effective, countChunkTokens: count, joinTokens });
    let selected = this.compression.compress(this.ordering.order(allocated.included));
    let truncated = allocated.truncated;
    let usedTokens = this.measure(selected, count, joinTokens, extras);
    while (selected.length > 0 && usedTokens > effective) {
      let dropAt = 0;
      for (let i = 1; i < selected.length; i++) {
        const candidate = selected[i];
        const lowest = selected[dropAt];
        if (candidate !== undefined && lowest !== undefined && candidate.score < lowest.score) dropAt = i;
      }
      const next = selected.filter((_, i) => i !== dropAt);
      selected = this.compression.compress(this.ordering.order(next));
      usedTokens = this.measure(selected, count, joinTokens, extras);
      truncated = true;
    }
    const chainMs = Date.now() - tChain;

    const marked = assignMarkers(selected);
    usedTokens = this.measure(marked.chunks, count, joinTokens, extras);
    return {
      chunks: marked.chunks,
      citations: marked.citations,
      usedTokens,
      tokenBudget: configured,
      effectiveBudget: effective,
      truncated,
      diagnostics: {
        resolveMs,
        buildMs: makeMs,
        chainMs,
        totalMs: Date.now() - t0,
        inputCount: chunks.length,
        expandedCount: expanded.length,
        dedupedCount: deduped.length,
        selectedCount: marked.chunks.length,
        queryChars,
      },
    };
  }

  private resolveBudget(override: number | undefined): number {
    const configured = override ?? this.tokenBudget;
    if (!Number.isInteger(configured) || configured < 0) {
      throw new Error(
        `DefaultContextBuilder: tokenBudget must be a non-negative integer, got ${configured}`,
      );
    }
    return configured;
  }

  private effectiveCap(configured: number, overhead: number): number {
    if (!Number.isInteger(overhead) || overhead < 0) {
      throw new Error(
        `DefaultContextBuilder: promptOverheadTokens must be a non-negative integer, got ${overhead}`,
      );
    }
    return Math.max(0, configured - this.reservedForResponse - overhead);
  }

  private measure(
    chunks: readonly ContextChunk[],
    count: (chunk: ContextChunk) => number,
    joinTokens: number,
    extras: (chunks: readonly ContextChunk[]) => number,
  ): number {
    let used = 0;
    for (let i = 0; i < chunks.length; i++) {
      const chunk = chunks[i];
      if (chunk === undefined) continue;
      used += count(chunk);
      if (i > 0) used += joinTokens;
    }
    return used + extras(chunks);
  }

  private async resolveSpan(documentId: DocumentId, span: TextSpan): Promise<string> {
    return this.resolver.resolve({
      id: createChunkId("span-union"),
      documentId,
      span,
      metadata: {},
    });
  }

  private async makeChunk(
    chunk: Chunk,
    text: string,
    score: number,
    embedding: Float32Array | undefined,
    cache: Map<string, SourceDocument | null>,
  ): Promise<ContextChunk> {
    const doc = await this.readDocument(String(chunk.documentId), cache);
    const timestamp = typeof chunk.metadata["timestamp"] === "number" ? chunk.metadata["timestamp"] : undefined;
    const speaker = typeof chunk.metadata["speaker"] === "string" ? chunk.metadata["speaker"] : undefined;
    const label = doc !== undefined && typeof doc.metadata["title"] === "string" ? doc.metadata["title"] : undefined;
    const rawUrl = doc !== undefined && typeof doc.metadata["url"] === "string" ? doc.metadata["url"] : undefined;
    const url =
      rawUrl !== undefined && timestamp !== undefined && rawUrl.includes("youtube.com/watch")
        ? withWatchTimestamp(rawUrl, timestamp)
        : rawUrl;
    let out: ContextChunk = {
      chunkId: chunk.id,
      documentId: chunk.documentId,
      text,
      score,
      span: chunk.span,
      citation: makeCitation({
        documentId: chunk.documentId,
        chunkId: chunk.id,
        ...(label !== undefined ? { label } : {}),
        ...(url !== undefined ? { url } : {}),
      }),
    };
    if (timestamp !== undefined) out = { ...out, timestamp };
    if (speaker !== undefined) out = { ...out, speaker };
    if (embedding !== undefined) out = { ...out, embedding };
    return out;
  }

  private async readDocument(
    id: string,
    cache: Map<string, SourceDocument | null>,
  ): Promise<SourceDocument | undefined> {
    const documents = this.documents;
    if (documents === undefined) return undefined;
    const cached = cache.get(id);
    if (cached !== undefined) return cached ?? undefined;
    let doc: SourceDocument | undefined;
    if (isDocumentRepository(documents)) {
      const got = await documents.get(id as DocumentId);
      doc = got ?? undefined;
    } else {
      doc = documents.get(id);
    }
    cache.set(id, doc ?? null);
    return doc;
  }
}

function makeDefaultResolver(documents: DocumentSource | undefined): ChunkContentResolver {
  if (documents === undefined) {
    throw new Error(
      "DefaultContextBuilder: either options.resolver or options.documents is required",
    );
  }
  if (isDocumentRepository(documents)) return new SpanChunkContentResolver(documents);
  return new InMemoryChunkContentResolver(documents);
}

function isDocumentRepository(value: DocumentSource): value is DocumentRepository {
  return typeof (value as DocumentRepository).save === "function";
}

function assignMarkers(chunks: readonly ContextChunk[]): {
  readonly chunks: readonly ContextChunk[];
  readonly citations: readonly ContextCitation[];
} {
  const marked = chunks.map((chunk, index) => {
    const marker = index + 1;
    const citation = stampCitation(chunk.citation, marker, chunk.timestamp);
    const merged = chunk.mergedCitations?.map((item) => stampCitation(item, marker, chunk.timestamp));
    let next: ContextChunk = { ...chunk, citation };
    if (merged !== undefined) next = { ...next, mergedCitations: merged };
    return next;
  });
  return {
    chunks: marked,
    citations: dedupeCitations(marked.flatMap((chunk) => [chunk.citation, ...(chunk.mergedCitations ?? [])])),
  };
}

function stampCitation(
  citation: ContextCitation,
  marker: number,
  timestamp: number | undefined,
): ContextCitation {
  const withMarker: ContextCitation = { ...citation, marker };
  if (withMarker.url === undefined || timestamp === undefined) return withMarker;
  if (!withMarker.url.includes("youtube.com/watch")) return withMarker;
  return { ...withMarker, url: withWatchTimestamp(withMarker.url, timestamp) };
}

function withWatchTimestamp(url: string, timestamp: number): string {
  const base = url
    .replace(/([?&])t=\d+/g, "")
    .replace(/[?&]$/, "")
    .replace(/\?&/, "?")
    .replace(/&&/g, "&");
  const joiner = base.includes("?") ? "&" : "?";
  return `${base}${joiner}t=${Math.floor(timestamp)}`;
}
