import { KernelError } from "@lyra-sdk/kernel";
import type { SimilarityMetric } from "./similarity-metric.js";

/**
 * Negative Euclidean distance (so that higher = more similar, matching
 * the convention of the other metrics).
 *
 *   score(a, b) = -||a - b||₂
 *
 * Range: (-∞, 0]. The caller may want to apply a monotonic transform
 * (e.g. `1 / (1 + |score|)`) for visualization, but the raw negative
 * distance is the canonical score.
 */
export class EuclideanSimilarity implements SimilarityMetric {
  public score(a: Float32Array, b: Float32Array): number {
    if (a.length !== b.length) {
      throw new KernelError(
        "invalid_argument",
        `EuclideanSimilarity: length mismatch (${a.length} vs ${b.length})`,
      );
    }
    let sum = 0;
    for (let i = 0; i < a.length; i++) {
      const d = a[i]! - b[i]!;
      sum += d * d;
    }
    return -Math.sqrt(sum);
  }
}
