import type { ChunkId } from "@lyra-sdk/kernel";
import type { ScoredChunk } from "@lyra-sdk/retrieval";
import type { RetrievalMetric } from "../contracts/retrieval-metric.js";

/**
 * Hit Rate (also called "Recall at any rank", "Top-k Accuracy",
 * or "Success@K"). 1 if any relevant chunk appears in the
 * top-k predictions; 0 otherwise.
 *
 * Cheaper than Recall@K when the test set has many singletons
 * (queries with exactly one relevant chunk).
 */
export class HitRate implements RetrievalMetric {
  public readonly name: string;
  private readonly k: number;

  constructor(k: number) {
    this.k = k;
    this.name = `hit_rate@${k}`;
  }

  public evaluate(predictions: readonly ScoredChunk[], groundTruth: readonly ChunkId[]): number {
    if (groundTruth.length === 0) return 0;
    const relevant = new Set<string>(groundTruth.map((id) => id as string));
    const top = predictions.slice(0, this.k);
    for (const p of top) {
      if (relevant.has(p.chunk.id as string)) return 1;
    }
    return 0;
  }
}
