import type { ChunkId } from "@lyra-sdk/kernel";

/**
 * One retrieval example: a query and the chunk ids judged
 * relevant. The benchmark runner queries the retriever with
 * `query`, gets the top-k predictions, and compares against
 * `relevant`.
 *
 * Phase 2 uses binary relevance (`relevant` is a set of chunk
 * ids). Phase 3+ may add `relevanceGrades: Map<ChunkId, number>`
 * for graded NDCG.
 */
export interface RetrievalExample {
  readonly query: string;
  readonly relevant: readonly ChunkId[];
}

/**
 * A `RetrievalDataset` is a named, ordered collection of
 * `RetrievalExample`s plus the `ChunkRepository` (and any
 * `DocumentRepository` for parent retrieval) the retriever
 * reads from. The retriever sees the dataset's pre-populated
 * repositories at query time; the benchmark does not index
 * anything during the run.
 *
 * Two Phase 2 implementations:
 *   - `GoldenDataset` — hand-curated examples for regression
 *     testing.
 *   - `SyntheticDataset` — programmatically generated examples
 *     for stress testing.
 */
export interface RetrievalDataset {
  readonly name: string;
  readonly examples: readonly RetrievalExample[];
}
