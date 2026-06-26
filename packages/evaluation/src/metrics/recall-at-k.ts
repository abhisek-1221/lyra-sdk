import type { ChunkId } from "@lyra-sdk/kernel";
import type { ScoredChunk } from "@lyra-sdk/retrieval";
import type { RetrievalMetric } from "../contracts/retrieval-metric.js";

/**
 * Recall@K. The fraction of relevant chunks that appear in the
 * top-k predictions.
 *
 *   recall@k = |relevant ∩ predictions[:k]| / |relevant|
 *
 * If the ground truth is empty, returns 0 (a degenerate query;
 * the benchmark should filter these out or report them
 * separately).
 */
export class RecallAtK implements RetrievalMetric {
  public readonly name: string;
  private readonly k: number;

  constructor(k: number) {
    this.k = k;
    this.name = `recall@${k}`;
  }

  public evaluate(predictions: readonly ScoredChunk[], groundTruth: readonly ChunkId[]): number {
    if (groundTruth.length === 0) return 0;
    const relevant = new Set<string>(groundTruth.map((id) => id as string));
    const top = predictions.slice(0, this.k);
    let hit = 0;
    for (const p of top) {
      if (relevant.has(p.chunk.id as string)) hit += 1;
    }
    return hit / groundTruth.length;
  }
}
