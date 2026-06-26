import type { Embedder } from "@lyra-sdk/embedding";
import type { ContextBuilder } from "@lyra-sdk/context";
import type { ChunkContentResolver, ChunkStrategy, SourceParser } from "@lyra-sdk/ingestion";
import type { BM25Index, VectorIndex } from "@lyra-sdk/index";
import type { Reranker } from "@lyra-sdk/reranking";
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
 *   - `withLexicalIndex` (Phase 2) to populate a BM25 index
 *     during ingest.
 *   - `withReranker` (Phase 3) to reorder candidates before
 *     context construction.
 *   - `withContextBuilder` (Phase 3) to assemble the final
 *     prompt context.
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
  public _lexicalIndex?: BM25Index;
  public _reranker?: Reranker;
  public _contextBuilder?: ContextBuilder;

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

  /**
   * Phase 2: provide a BM25 lexical index. The pipeline will
   * populate it with each chunk's text during ingest. The
   * application retains ownership of the index and uses the
   * same reference to build its `BM25Retriever`.
   */
  public withLexicalIndex(index: BM25Index): this {
    this._lexicalIndex = index;
    return this;
  }

  /**
   * Phase 3: provide a `Reranker`. The pipeline runs it on the
   * `Retriever`'s output before the context builder.
   */
  public withReranker(reranker: Reranker): this {
    this._reranker = reranker;
    return this;
  }

  /**
   * Phase 3: provide a `ContextBuilder`. The pipeline runs it on
   * the reranked candidates to produce the prompt context.
   */
  public withContextBuilder(builder: ContextBuilder): this {
    this._contextBuilder = builder;
    return this;
  }

  public build(): RetrievalPipeline {
    return buildRetrievalPipeline(this);
  }
}
