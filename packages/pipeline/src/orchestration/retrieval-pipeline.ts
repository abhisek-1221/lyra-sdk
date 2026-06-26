import { KernelError } from "@lyra-sdk/kernel";
import type { Embedder } from "@lyra-sdk/embedding";
import type { ChunkContentResolver, ChunkStrategy, SourceParser } from "@lyra-sdk/ingestion";
import type { VectorIndex } from "@lyra-sdk/index";
import type { RetrievalResult, Retriever } from "@lyra-sdk/retrieval";
import type { Chunk, ChunkRepository, DocumentRepository } from "@lyra-sdk/storage";
import { RetrievalPipelineBuilder } from "../builder/retrieval-pipeline-builder.js";
import { RetrievalRuntime } from "../runtime/retrieval-runtime.js";

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
}

/**
 * The retrieval pipeline. The single entry point for the runtime;
 * the public API of `@lyra-sdk/pipeline`.
 *
 * Responsibilities:
 *   - `ingest` — orchestrate parser → chunker → embedder → index.
 *     Saves the source document, the chunks, and the vectors.
 *   - `query` — delegate to the configured `Retriever`.
 *   - `dispose` — release resources via the runtime.
 *
 * The pipeline deliberately does **not** know about HTTP, cache
 * files, or specific providers. Those are cross-cutting concerns
 * applied at the embedder and repository boundaries.
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
   * Steps:
   *   1. `sourceParser.parse(input)` → `SourceDocument`
   *   2. Save the document via `documents.save`.
   *   3. `segmenter.chunk(document)` → `Chunk[]`
   *   4. Save the chunks via `chunks.save`.
   *   5. Resolve each chunk's text via `contentResolver.resolveMany`.
   *   6. `embedder.embedMany(texts)` → `Embedding[]`
   *   7. Build `IndexedVector[]` from the embeddings.
   *   8. `index.upsert(vectors)`.
   */
  public async ingest(input: unknown): Promise<void> {
    this.assertNotDisposed();
    await this.runtime.ingest(input);
  }

  /**
   * Ingest many sources sequentially. Concurrency control is the
   * caller's responsibility in Phase 1; Phase 2 may add a
   * concurrency limit option.
   */
  public async ingestMany(inputs: readonly unknown[]): Promise<void> {
    this.assertNotDisposed();
    for (const input of inputs) {
      await this.ingest(input);
    }
  }

  /**
   * Query the index. Delegates to the configured `Retriever`.
   */
  public async query(text: string, k = 5): Promise<RetrievalResult> {
    this.assertNotDisposed();
    return this.deps.retriever.retrieve(text, k);
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

export type { Chunk };
