import type { ChunkId } from "@lyra-sdk/kernel";
import type { ScoredChunk } from "@lyra-sdk/retrieval";
import type { RetrievalMetric } from "../contracts/retrieval-metric.js";

/**
 * Mean Reciprocal Rank (MRR). The reciprocal rank of the first
 * relevant prediction. Returns 0 if no relevant chunk appears
 * in the predictions.
 *
 *   mrr = 1 / rank_of_first_relevant
 *
 * Aggregated across queries by simple averaging.
 */
export class MeanReciprocalRank implements RetrievalMetric {
  public readonly name = "mrr";

  public evaluate(predictions: readonly ScoredChunk[], groundTruth: readonly ChunkId[]): number {
    if (groundTruth.length === 0) return 0;
    const relevant = new Set<string>(groundTruth.map((id) => id as string));
    for (let i = 0; i < predictions.length; i++) {
      if (relevant.has(predictions[i]!.chunk.id as string)) {
        return 1 / (i + 1);
      }
    }
    return 0;
  }
}
