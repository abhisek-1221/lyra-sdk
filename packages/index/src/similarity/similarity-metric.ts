/**
 * A `SimilarityMetric` is a strategy for scoring the similarity
 * between two vectors. The index is constructed with a metric baked
 * in; the retriever never sees it.
 *
 * All metrics assume the two inputs have the same `length`. Mismatched
 * lengths are a programming error and throw at the metric call site
 * (the index guards against this on `upsert`).
 */
export interface SimilarityMetric {
  /** Score in (-1, 1] for cosine, [0, +∞) for dot / euclidean(-). */
  score(a: Float32Array, b: Float32Array): number;
}
