import type { RetrievalResult } from "./retrieval-result.js";

/**
 * The retriever contract. **Query-only**: a `Retriever` knows
 * nothing about ingest. The pipeline is responsible for parsing,
 * chunking, embedding, and indexing; the retriever's only job is to
 * answer `retrieve(query, k)`.
 *
 * Implementations MUST:
 *   - Return at most `k` results.
 *   - Return results in descending score order.
 *   - Resolve each `SearchHit.id` to a `Chunk` before returning. The
 *     retriever is the layer that joins the index's id list with the
 *     `ChunkRepository`'s chunk records.
 *   - Echo the input `query` in the `RetrievalResult.query` field.
 *
 * Implementations MAY:
 *   - Compose other `Retriever`s (a future `HybridRetriever` is a
 *     `Retriever` that delegates to a dense and a BM25 retriever).
 *   - Filter or re-rank the candidates before returning.
 */
export interface Retriever {
  retrieve(query: string, k: number): Promise<RetrievalResult>;
}
