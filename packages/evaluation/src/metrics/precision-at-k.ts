import type { ChunkId } from "@lyra-sdk/kernel";
import type { ScoredChunk } from "@lyra-sdk/retrieval";
import type { RetrievalMetric } from "../contracts/retrieval-metric.js";

/**
 * Precision@K. The fraction of the top-k predictions that are
 * relevant.
 *
 *   precision@k = |relevant ∩ predictions[:k]| / k
 *
 * Note: k is the divisor, not the number of relevant items. If
 * fewer than k predictions are returned, the divisor is the
 * number of predictions, not k. (Most benchmark literature uses
 * `min(k, |predictions|)` as the divisor; we follow the
 * simpler convention.)
 */
export class PrecisionAtK implements RetrievalMetric {
  public readonly name: string;
  private readonly k: number;

  constructor(k: number) {
    this.k = k;
    this.name = `precision@${k}`;
  }

  public evaluate(predictions: readonly ScoredChunk[], groundTruth: readonly ChunkId[]): number {
    const top = predictions.slice(0, this.k);
    if (top.length === 0) return 0;
    const relevant = new Set<string>(groundTruth.map((id) => id as string));
    let hit = 0;
    for (const p of top) {
      if (relevant.has(p.chunk.id as string)) hit += 1;
    }
    return hit / top.length;
  }
}
