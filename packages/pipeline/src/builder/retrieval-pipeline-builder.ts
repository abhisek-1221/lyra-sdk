import type { Embedder } from "@lyra-sdk/embedding";
import type { ChunkContentResolver, ChunkStrategy, SourceParser } from "@lyra-sdk/ingestion";
import type { VectorIndex } from "@lyra-sdk/index";
import type { Retriever } from "@lyra-sdk/retrieval";
import type { ChunkRepository, DocumentRepository } from "@lyra-sdk/storage";
import { buildRetrievalPipeline } from "../orchestration/build-retrieval-pipeline.js";
import type { RetrievalPipeline } from "../orchestration/retrieval-pipeline.js";

/**
 * The fluent builder for `RetrievalPipeline`. Methods read like
 * English and return `this` for chaining. Validates the
 * configuration at `build()` time.
 *
 * Required:
 *   - `withParser(input → SourceDocument)`
 *   - `withChunkStrategy(document → Chunk[])`
 *   - `withEmbedder(Embedder)`
 *   - `withChunkRepository(ChunkRepository)`
 *   - `withDocumentRepository(DocumentRepository)`
 *   - `withIndex(VectorIndex)`
 *
 * Optional:
 *   - `withContentResolver` for the ingestion chain to derive
 *     chunk text on demand. Defaults to a `SpanChunkContentResolver`
 *     built from the supplied `withDocumentRepository` repo.
 *   - `withRetriever` for the query path. Defaults to a
 *     `DenseRetriever` composed from `index`, `embedder`, and
 *     `chunkRepository`.
 */
export class RetrievalPipelineBuilder {
  // Internal state. Marked with the `_internal` prefix and exposed
  // only via `build()`. Callers should never read or write these
  // directly; use the fluent methods.
  public _sourceParser?: SourceParser<unknown>;
  public _segmenter?: ChunkStrategy;
  public _embedder?: Embedder;
  public _chunks?: ChunkRepository;
  public _documents?: DocumentRepository;
  public _index?: VectorIndex;
  public _contentResolver?: ChunkContentResolver;
  public _retriever?: Retriever;

  public withParser<P>(parser: SourceParser<P>): this {
    this._sourceParser = parser as SourceParser<unknown>;
    return this;
  }

  public withChunkStrategy(strategy: ChunkStrategy): this {
    this._segmenter = strategy;
    return this;
  }

  public withEmbedder(embedder: Embedder): this {
    this._embedder = embedder;
    return this;
  }

  public withChunkRepository(repo: ChunkRepository): this {
    this._chunks = repo;
    return this;
  }

  public withDocumentRepository(repo: DocumentRepository): this {
    this._documents = repo;
    return this;
  }

  public withIndex(index: VectorIndex): this {
    this._index = index;
    return this;
  }

  public withContentResolver(resolver: ChunkContentResolver): this {
    this._contentResolver = resolver;
    return this;
  }

  public withRetriever(retriever: Retriever): this {
    this._retriever = retriever;
    return this;
  }

  public build(): RetrievalPipeline {
    return buildRetrievalPipeline(this);
  }
}
