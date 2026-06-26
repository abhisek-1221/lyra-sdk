import type { ChunkContentResolver } from "@lyra-sdk/ingestion";
import type { ScoredChunk } from "@lyra-sdk/retrieval";
import type { SourceDocument } from "@lyra-sdk/storage";
import type { Context } from "../types/index.js";
import type { ContextChunk, ContextCitation } from "../types/index.js";
import { dedupeCitations, makeCitation } from "../citations/index.js";
import { InMemoryChunkContentResolver } from "./in-memory-chunk-content-resolver.js";
import type { ContextBuilder } from "./context-builder.js";
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
 * The builder is **composable, not opinionated**: every strategy
 * slot is replaceable. The defaults are transcript-friendly
 * because Lyra's primary corpus is transcripts, but pure-text
 * applications pass `ScoreOrdering` and `IdentityExpander`
 * explicitly. The builder does not auto-select.
 */
export interface ContextBuilderOptions {
  /** Total tokens available for the prompt context. Required. */
  readonly tokenBudget: number;
  /**
   * Reserve this many tokens for the LLM's response. Default: 0.
   */
  readonly reservedForResponse?: number;
  /** Counter for tokens. Default: `CharHeuristicTokenCounter`. */
  readonly tokenCounter?: TokenCounter;
  /**
   * Resolver for chunk text. Default: an
   * `InMemoryChunkContentResolver` built from `documents`.
   * Supply one explicitly if you have a streaming or
   * memoizing resolver.
   */
  readonly resolver?: ChunkContentResolver;
  /**
   * Map of documentId -> SourceDocument. Used to build the
   * default resolver when `resolver` is not supplied. Either
   * `resolver` or `documents` is required.
   */
  readonly documents?: ReadonlyMap<string, SourceDocument>;
  /** Expander slot. Default: `IdentityExpander`. */
  readonly expander?: Expander;
  /** Deduplicator slot. Default: `DefaultDeduplicator`. */
  readonly deduplication?: Deduplicator;
  /** Ordering slot. Default: `TranscriptOrdering`. */
  readonly ordering?: ContextOrdering;
  /** Compressor slot. Default: `MetadataStrippingCompressor`. */
  readonly compression?: Compressor;
}

/**
 * The default context builder. The chain is:
 *
 *   resolve -> expander -> deduplication -> ordering
 *     -> budgetAllocator -> compression
 *
 * Each step is optional; missing slots are no-ops. The
 * builder is deterministic with respect to its inputs and
 * configuration.
 */
export class DefaultContextBuilder implements ContextBuilder {
  public readonly name: string;
  private readonly options: ContextBuilderOptions & {
    readonly ordering: ContextOrdering;
    readonly deduplication: Deduplicator;
    readonly expander: Expander;
    readonly compression: Compressor;
    readonly counter: TokenCounter;
    readonly resolver: ChunkContentResolver;
    readonly allocator: BudgetAllocator;
  };

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
    const resolver = options.resolver ?? makeDefaultResolver(options);
    this.options = {
      ...options,
      reservedForResponse,
      counter,
      resolver,
      ordering: options.ordering ?? new TranscriptOrdering(),
      deduplication: options.deduplication ?? new DefaultDeduplicator(),
      expander: options.expander ?? new IdentityExpander(),
      compression: options.compression ?? new MetadataStrippingCompressor(),
      allocator: new BudgetAllocator({
        counter,
        budget: makeTokenBudget(options.tokenBudget, reservedForResponse),
      }),
    };
    this.name = "default";
  }

  public async build(chunks: readonly ScoredChunk[]): Promise<Context> {
    const t0 = Date.now();
    if (chunks.length === 0) {
      return {
        chunks: [],
        citations: [],
        usedTokens: 0,
        tokenBudget: this.options.tokenBudget,
        truncated: false,
        diagnostics: { totalMs: Date.now() - t0 },
      };
    }
    // 1. Resolve texts.
    const tResolve = Date.now();
    const textList = await this.options.resolver.resolveMany(chunks.map((c) => c.chunk));
    const resolveMs = Date.now() - tResolve;

    // 2. Build initial ContextChunk[] (with citations and metadata).
    const tMake = Date.now();
    const initial: ContextChunk[] = chunks.map((c, i) => {
      const text = textList[i] ?? "";
      const labelRaw = c.chunk.metadata["title"];
      const urlRaw = c.chunk.metadata["url"];
      const citation = makeCitation({
        documentId: c.chunk.documentId,
        chunkId: c.chunk.id,
        ...(typeof labelRaw === "string" ? { label: labelRaw } : {}),
        ...(typeof urlRaw === "string" ? { url: urlRaw } : {}),
      });
      const out: ContextChunk = {
        chunkId: c.chunk.id,
        documentId: c.chunk.documentId,
        text,
        score: c.score,
        span: c.chunk.span,
        citation,
      };
      const ts = c.chunk.metadata["timestamp"];
      if (typeof ts === "number") {
        return { ...out, timestamp: ts };
      }
      const speaker = c.chunk.metadata["speaker"];
      if (typeof speaker === "string") {
        return { ...out, speaker };
      }
      if (c.embedding !== undefined) {
        return { ...out, embedding: c.embedding };
      }
      return out;
    });
    const makeMs = Date.now() - tMake;

    // 3. Apply the transform chain.
    const tChain = Date.now();
    let xs: readonly ContextChunk[] = this.options.expander.expand(initial);
    xs = this.options.deduplication.deduplicate(xs);
    xs = this.options.ordering.order(xs);
    const allocated = this.options.allocator.allocate(xs);
    xs = this.options.compression.compress(allocated.included);
    const chainMs = Date.now() - tChain;

    // 4. Assemble Context.
    const citations: readonly ContextCitation[] = dedupeCitations(xs.map((c) => c.citation));
    return {
      chunks: xs,
      citations,
      usedTokens: allocated.usedTokens,
      tokenBudget: this.options.tokenBudget,
      truncated: allocated.truncated,
      diagnostics: {
        resolveMs,
        buildMs: makeMs,
        chainMs,
        totalMs: Date.now() - t0,
      },
    };
  }
}

function makeDefaultResolver(options: ContextBuilderOptions) {
  if (options.documents === undefined) {
    throw new Error(
      "DefaultContextBuilder: either options.resolver or options.documents is required",
    );
  }
  return new InMemoryChunkContentResolver(options.documents);
}
