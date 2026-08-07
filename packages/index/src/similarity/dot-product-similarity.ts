import { KernelError } from "@lyra-sdk/kernel";
import type { SimilarityMetric } from "./similarity-metric.js";

/**
 * Dot product similarity. Range: unbounded.
 *
 *   a · b = Σ aᵢ · bᵢ
 *
 * Only meaningful when all vectors are L2-normalized. If you intend
 * cosine, use {@link CosineSimilarity} (which works regardless of
 * magnitude). If you have a model that produces non-normalized
 * vectors and you want magnitude to matter (e.g. BM25-style
 * weighting), use this.
 */
export class DotProductSimilarity implements SimilarityMetric {
  public score(a: Float32Array, b: Float32Array): number {
    if (a.length !== b.length) {
      throw new KernelError(
        "invalid_argument",
        `DotProductSimilarity: length mismatch (${a.length} vs ${b.length})`,
      );
    }
    let sum = 0;
    for (let i = 0; i < a.length; i++) {
      sum += a[i]! * b[i]!;
    }
    return sum;
  }
}
