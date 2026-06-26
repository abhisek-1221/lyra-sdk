import type { ChunkId } from "@lyra-sdk/kernel";
import type { ScoredChunk } from "@lyra-sdk/retrieval";
import type { RetrievalMetric } from "../contracts/retrieval-metric.js";

/**
 * Mean Average Precision (MAP). The mean over queries of the
 * average precision per query.
 *
 *   ap = Σ_{i=1..k} (precision@i * rel(i)) / |relevant|
 *
 * where `rel(i)` is 1 if the i-th prediction is relevant, 0
 * otherwise. The standard formulation.
 *
 * Note: AP is the per-query metric. "MAP" is the mean over a
 * dataset of APs. The `Benchmark` runner does the averaging.
 */
export class MeanAveragePrecision implements RetrievalMetric {
  public readonly name = "map";

  public evaluate(predictions: readonly ScoredChunk[], groundTruth: readonly ChunkId[]): number {
    if (groundTruth.length === 0) return 0;
    const relevant = new Set<string>(groundTruth.map((id) => id as string));
    let hits = 0;
    let sumPrecision = 0;
    for (let i = 0; i < predictions.length; i++) {
      const p = predictions[i]!;
      if (relevant.has(p.chunk.id as string)) {
        hits += 1;
        sumPrecision += hits / (i + 1);
      }
    }
    return sumPrecision / groundTruth.length;
  }
}
