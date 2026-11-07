import { KernelError } from "@lyra-sdk/kernel";
import type { Embedder } from "@lyra-sdk/embedding";
import type { ContextBuildOptions, ContextBuilder, ContextChunk, TokenCounter } from "@lyra-sdk/context";
import type { Generator, GenerationOptions } from "@lyra-sdk/generation";
import type {
  ChunkContentResolver,
  ChunkStrategy,
  SourceParser,
  YouTubeTranscriptLoader,
  YouTubeTranscriptLoadOptions,
} from "@lyra-sdk/ingestion";
import type { BM25Index, VectorIndex } from "@lyra-sdk/index";
import { DefaultPromptBuilder, type Prompt, type PromptBuilder } from "@lyra-sdk/prompt";
import type { Reranker } from "@lyra-sdk/reranking";
import type { Retriever } from "@lyra-sdk/retrieval";
import type { Chunk, ChunkRepository, DocumentRepository } from "@lyra-sdk/storage";
import { RetrievalPipelineBuilder } from "../builder/retrieval-pipeline-builder.js";
import { RetrievalRuntime } from "../runtime/retrieval-runtime.js";
import type { AskRequest } from "./ask-request.js";
import type { AskResult } from "./ask-result.js";
import { emptyContext, type PipelineResult } from "./pipeline-result.js";

/**
 * The runtime configuration for a `RetrievalPipeline`. Held as a
 * frozen bag of dependencies; the runtime does not mutate any of
 * them. Replacing a dependency means building a new pipeline.
 */
export interface RetrievalPipelineDeps {
  readonly sourceParser: SourceParser<unknown>;
  readonly segmenter: ChunkStrategy;
  readonly embedder: Embedder;
  readonly chunks: ChunkRepository;
  readonly documents: DocumentRepository;
  readonly index: VectorIndex;
  readonly contentResolver: ChunkContentResolver;
  readonly retriever: Retriever;
  /**
   * Optional YouTube transcript loader. When `ingest` receives a
   * YouTube URL string or `{ url }` / `{ videoId }`, the pipeline
   * loads the transcript through this loader before parsing.
   * Default: `CoreYouTubeTranscriptLoader` (requires peer `lyra-sdk`).
   */
  readonly youtubeLoader?: YouTubeTranscriptLoader;
  /**
   * Default options passed to `youtubeLoader.load` when the caller
   * does not supply per-call options on `ingest`.
   */
  readonly youtubeLoadOptions?: YouTubeTranscriptLoadOptions;
  /**
   * Optional lexical index. When provided, the pipeline
   * populates it with each chunk's text during ingest so that a
   * `BM25Retriever` (or any other lexical retriever) can search
   * the same corpus. The pipeline does NOT own the index's
   * lifecycle — the application constructs it and uses the same
   * reference to build its `BM25Retriever`.
   */
  readonly lexicalIndex?: BM25Index;
  /**
   * Optional reranker. Applied to the retriever's output before
   * the context builder. Phase 3.
   */
  readonly reranker?: Reranker;
  /**
   * Optional context builder. Applied to the reranked output to
   * produce the final prompt context. Phase 3.
   */
  readonly contextBuilder?: ContextBuilder;
  /**
   * Optional prompt builder. Used to assemble a `Prompt` from
   * the `Context` and the user's query. Phase 4.
   *
   * Default: `new DefaultPromptBuilder()` when `generator` is
   * configured. Ignored when `generator` is not configured.
   */
  readonly promptBuilder?: PromptBuilder;
  /**
   * Optional generator. When configured, `ask` is available.
   * Phase 4.
   */
  readonly generator?: Generator;
}

/**
 * The retrieval pipeline. The single entry point for the runtime;
 * the public API of `@lyra-sdk/pipeline`.
 *
 * Responsibilities:
 *   - `ingest` — orchestrate parser → chunker → embedder → index.
 *     Saves the source document, the chunks, and the vectors.
 *   - `query` — delegate to the configured `Retriever`, then
 *     optionally run the configured `Reranker` and
 *     `ContextBuilder`. Phase 3.
 *   - `ask` — run the full chain (retrieve → rerank → build
 *     context → build prompt → generate) and return the
 *     `AskResult`. Phase 4.
 *   - `dispose` — release resources via the runtime.
 *
 * The pipeline deliberately does **not** know about HTTP, cache
 * files, or specific providers. Those are cross-cutting concerns
 * applied at the embedder, repository, and generator boundaries.
 */
export class RetrievalPipeline {
  private readonly deps: RetrievalPipelineDeps;
  private readonly runtime: RetrievalRuntime;
  private disposed = false;

  constructor(deps: RetrievalPipelineDeps) {
    this.deps = deps;
    this.runtime = new RetrievalRuntime(deps);
  }

  /**
   * Ingest a single source through the full chain.
   *
   * When `input` is a YouTube URL string or `{ url }` / `{ videoId }`,
   * the pipeline first loads the transcript via `youtubeLoader`
   * (default `CoreYouTubeTranscriptLoader`), then continues:
   *
   * Steps:
   *   1. (YouTube only) `youtubeLoader.load(input)` → transcript
   *   2. `sourceParser.parse(...)` → `SourceDocument`
   *   3. Save the document via `documents.save`.
   *   4. `segmenter.chunk(document)` → `Chunk[]`
   *   5. Save the chunks via `chunks.save`.
   *   6. Resolve each chunk's text via `contentResolver.resolveMany`.
   *   7. `embedder.embedMany(texts)` → `Embedding[]`
   *   8. Build `IndexedVector[]` from the embeddings.
   *   9. `index.upsert(vectors)`.
   *
   * Transcript objects (`meta` + `lines`) skip the load step and
   * go straight to the parser.
   */
  public async ingest(input: unknown, options?: YouTubeTranscriptLoadOptions): Promise<void> {
    this.assertNotDisposed();
    await this.runtime.ingest(input, options);
  }

  /**
   * Ingest many sources sequentially. Concurrency control is the
   * caller's responsibility in Phase 1; Phase 2 may add a
   * concurrency limit option.
   *
   * `options` apply to every YouTube input in the batch.
   */
  public async ingestMany(
    inputs: readonly unknown[],
    options?: YouTubeTranscriptLoadOptions,
  ): Promise<void> {
    this.assertNotDisposed();
    for (const input of inputs) {
      await this.ingest(input, options);
    }
  }

  /**
   * Query the index. Delegates to the configured `Retriever`,
   * then optionally runs the configured `Reranker` and
   * `ContextBuilder`. Returns a `PipelineResult` that holds
   * the original `RetrievalResult`, the reranked candidates,
   * and the assembled `Context`.
   */
  public async query(text: string, k = 5, options?: QueryOptions): Promise<PipelineResult> {
    this.assertNotDisposed();
    const retrieval = await this.deps.retriever.retrieve(text, k);
    let reranked = retrieval.results;
    if (this.deps.reranker !== undefined) {
      const out = await this.deps.reranker.rerank(text, retrieval.results);
      reranked = out.results;
    }
    const context =
      this.deps.contextBuilder !== undefined
        ? await this.deps.contextBuilder.build(reranked, this.contextBuildOptions(text, options))
        : emptyContext();
    return { retrieval, reranked, context };
  }

  /**
   * Run the full RAG chain: `query → build prompt → generate`.
   * Returns an `AskResult` with the `PipelineResult`, the
   * assembled `Prompt`, and the `GenerationResponse`.
   *
   * The pipeline is the **single seam** that lifts citations
   * from `Context` to `GenerationResponse`. `Prompt` does not
   * carry citations; the prompt builder emits citation
   * markers (`[1]`, `[2]`, …) inline in the rendered chunk
   * text, and the application reads
   * `askResult.generation.citations` (or
   * `askResult.pipeline.context.citations` — same array) to
   * render the matching footer.
   *
   * Throws when no `generator` is configured. A pipeline
   * without a generator is a valid query-only pipeline; the
   * application builds a `Prompt` itself and calls the
   * generator directly.
   */
  public async ask<T = unknown>(request: AskRequest, options?: GenerationOptions): Promise<AskResult<T>> {
    this.assertNotDisposed();
    if (this.deps.generator === undefined) {
      throw new KernelError(
        "invalid_argument",
        "RetrievalPipeline.ask requires a generator; configure one with withGenerator()",
      );
    }

    const promptBuilder = request.prompt === undefined
      ? (this.deps.promptBuilder ?? new DefaultPromptBuilder())
      : undefined;
    const pipelineResult = await this.query(request.query, request.k ?? 5, {
      ...(promptBuilder?.estimatePromptOverhead !== undefined
        ? {
            promptOverheadTokens: promptBuilder.estimatePromptOverhead({
              ...(request.system !== undefined ? { system: request.system } : {}),
              query: request.query,
              ...(request.conversation !== undefined ? { conversation: request.conversation } : {}),
            }),
          }
        : {}),
      ...(promptBuilder !== undefined ? { promptBuilder } : {}),
    });
    if (this.deps.contextBuilder === undefined && pipelineResult.reranked.length > 0) {
      throw new KernelError(
        "invalid_argument",
        "RetrievalPipeline.ask requires a context builder when retrieval returns hits; configure one with withContextBuilder()",
      );
    }

    let prompt: Prompt;
    if (request.prompt !== undefined) {
      prompt = request.prompt;
    } else {
      const builder: PromptBuilder = promptBuilder ?? new DefaultPromptBuilder();
      prompt = builder.build({
        query: request.query,
        context: pipelineResult.context,
        ...(request.system !== undefined ? { system: request.system } : {}),
        ...(request.conversation !== undefined ? { conversation: request.conversation } : {}),
      });
    }

    const generation = await this.deps.generator.generate<T>({ prompt }, options);
    const citations = pipelineResult.context.citations;
    return {
      pipeline: pipelineResult,
      prompt,
      generation: { ...generation, citations } as typeof generation,
    };
  }

  /**
   * Release any resources held by the repositories and the runtime.
   * After `dispose`, all subsequent calls throw.
   */
  public dispose(): void {
    if (this.disposed) return;
    this.runtime.dispose();
    this.deps.chunks.dispose();
    this.deps.documents.dispose();
    this.disposed = true;
  }

  private contextBuildOptions(query: string, options?: QueryOptions): ContextBuildOptions {
    const promptBuilder = options?.promptBuilder ?? this.deps.promptBuilder;
    const estimateChunk = promptBuilder?.estimateChunkTokens?.bind(promptBuilder);
    const estimateSources = promptBuilder?.estimateSourceTokens?.bind(promptBuilder);
    const overhead = options?.promptOverheadTokens;
    return {
      query,
      ...(overhead !== undefined ? { promptOverheadTokens: overhead } : {}),
      ...(estimateChunk !== undefined
        ? {
            countChunkTokens: (chunk: ContextChunk, counter: TokenCounter, index: number) =>
              estimateChunk(chunk, counter, index),
            joinWith: "\n\n",
          }
        : {}),
      ...(estimateSources !== undefined
        ? {
            countExtras: (chunks: readonly ContextChunk[], counter: TokenCounter) =>
              estimateSources(chunks, counter),
          }
        : {}),
    };
  }

  private assertNotDisposed(): void {
    if (this.disposed) {
      throw new KernelError("internal", "RetrievalPipeline has been disposed");
    }
  }

  /**
   * Static factory: a fluent builder for callers who prefer that
   * style.
   */
  public static builder(): RetrievalPipelineBuilder {
    return new RetrievalPipelineBuilder();
  }
}

/**
 * Per-call options for {@link RetrievalPipeline.query}.
 * `ask` fills `promptOverheadTokens` from the prompt builder
 * unless the caller already supplied a `prompt`.
 */
export interface QueryOptions {
  readonly promptOverheadTokens?: number;
  /** Overrides `RetrievalPipelineDeps.promptBuilder` for token estimates on this call. */
  readonly promptBuilder?: PromptBuilder;
}

export type { Chunk };

