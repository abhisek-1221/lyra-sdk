import type { ChunkId } from "@lyra-sdk/kernel";
import type { ScoredChunk } from "@lyra-sdk/retrieval";
import type { RetrievalMetric } from "../contracts/retrieval-metric.js";

/**
 * Normalized Discounted Cumulative Gain (NDCG@k).
 *
 * NDCG rewards retrieving relevant chunks near the top, with
 * a logarithmic discount for lower ranks. Relevance grades in
 * Phase 2 are binary (0 or 1); graded relevance lands in
 * Phase 3+ with `RetrievalExample.relevanceGrades`.
 *
 *   dcg = Σ_{i=1..k} rel(i) / log2(i + 1)
 *   idcg = dcg of the ideal ranking (all relevant first)
 *   ndcg = dcg / idcg
 *
 * If the ground truth is empty, returns 0. If idcg is 0
 * (impossible — would require at least one relevant item in
 * the top-k), the metric returns 0 defensively.
 */
export class NDCG implements RetrievalMetric {
  public readonly name: string;
  private readonly k: number;

  constructor(k: number) {
    this.k = k;
    this.name = `ndcg@${k}`;
  }

  public evaluate(predictions: readonly ScoredChunk[], groundTruth: readonly ChunkId[]): number {
    if (groundTruth.length === 0) return 0;
    const relevant = new Set<string>(groundTruth.map((id) => id as string));
    const top = predictions.slice(0, this.k);
    let dcg = 0;
    for (let i = 0; i < top.length; i++) {
      if (relevant.has(top[i]!.chunk.id as string)) {
        // log2(i + 2) is the standard DCG discount (i+1 → log2(i+2) for 1-based rank i+1).
        dcg += 1 / Math.log2(i + 2);
      }
    }
    // idcg: rank all `min(k, |relevant|)` relevant items at the top.
    const idealHits = Math.min(this.k, groundTruth.length);
    let idcg = 0;
    for (let i = 0; i < idealHits; i++) {
      idcg += 1 / Math.log2(i + 2);
    }
    if (idcg === 0) return 0;
    return dcg / idcg;
  }
}
