import type { ChunkId } from "@lyra-sdk/kernel";
import type { ScoredChunk } from "@lyra-sdk/retrieval";

/**
 * A `RetrievalMetric` computes one retrieval-quality number for
 * a single query. The contract is intentionally tiny so a new
 * metric (e.g. Cohen's kappa, F1, calibrated recall) can be
 * added in one file.
 *
 * The metric is a Strategy pattern. The `Benchmark` runner
 * calls `evaluate(predictions, groundTruth)` once per query and
 * aggregates the per-query values into a final report.
 */
export interface RetrievalMetric {
  /** Aggregate name, e.g. `"recall@10"`. Used in benchmark reports. */
  readonly name: string;
  /**
   * Compute the metric for one query.
   *
   * - `predictions` is the retriever's top-k results, ordered
   *   descending by score (the `Retriever` contract).
   * - `groundTruth` is the set of chunk ids judged relevant.
   *
   * Return value is the metric's per-query value, in its
   * natural range. Most metrics return [0, 1]; the runner does
   * not bound-check.
   */
  evaluate(predictions: readonly ScoredChunk[], groundTruth: readonly ChunkId[]): number;
}
