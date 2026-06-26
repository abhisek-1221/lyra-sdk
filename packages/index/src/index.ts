/**
 * @lyra-sdk/index
 *
 * Vector index contracts, similarity metrics, and the Phase 1
 * in-memory `BruteForceIndex`. sqlite-vec, pgvector, and Qdrant land
 * in Phase 2 — they implement the same `VectorIndex` contract without
 * touching the retriever, the embedding layer, or the pipeline.
 *
 * Contents:
 *   - `VectorIndex`, `IndexedVector`, `SearchHit`, `IndexStats` — contracts
 *   - `SimilarityMetric`, `CosineSimilarity`, `DotProductSimilarity`, `EuclideanSimilarity` — strategies
 *   - `BruteForceIndex` — Phase 1 in-memory implementation
 *
 * @packageDocumentation
 */

export type { VectorIndex } from "./contracts/vector-index.js";
export type { IndexedVector, SearchHit, IndexStats } from "./contracts/indexed-vector.js";

export type { SimilarityMetric } from "./similarity/similarity-metric.js";
export { CosineSimilarity } from "./similarity/cosine-similarity.js";
export { DotProductSimilarity } from "./similarity/dot-product-similarity.js";
export { EuclideanSimilarity } from "./similarity/euclidean-similarity.js";

export { BruteForceIndex } from "./vector/brute-force-index.js";
