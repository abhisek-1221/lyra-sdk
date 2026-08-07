import { KernelError } from "@lyra-sdk/kernel";
import type { SimilarityMetric } from "./similarity-metric.js";

/**
 * Cosine similarity. Range: [-1, 1]. Higher is more similar.
 *
 *   cos(θ) = (a · b) / (||a|| · ||b||)
 *
 * Returns `0` if either vector has zero magnitude. This is a
 * defensive default that avoids `NaN` propagating into search scores;
 * a zero-magnitude vector is pathological and unlikely to be indexed
 * in practice (an embedder that returns a zero vector is broken).
 */
export class CosineSimilarity implements SimilarityMetric {
  public score(a: Float32Array, b: Float32Array): number {
    this.assertSameLength(a, b);
    let dot = 0;
    let normA = 0;
    let normB = 0;
    for (let i = 0; i < a.length; i++) {
      const ai = a[i]!;
      const bi = b[i]!;
      dot += ai * bi;
      normA += ai * ai;
      normB += bi * bi;
    }
    if (normA === 0 || normB === 0) return 0;
    return dot / (Math.sqrt(normA) * Math.sqrt(normB));
  }

  private assertSameLength(a: Float32Array, b: Float32Array): void {
    if (a.length !== b.length) {
      throw new KernelError(
        "invalid_argument",
        `CosineSimilarity: length mismatch (${a.length} vs ${b.length})`,
      );
    }
  }
}
