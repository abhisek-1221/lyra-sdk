import type { EmbeddingId } from "@lyra-sdk/kernel";

/**
 * Distinguishes between embeddings produced for documents (chunks being
 * indexed) and embeddings produced for queries (search inputs).
 *
 * Some providers (OpenAI, Voyage, Cohere) support distinct encodings
 * for the two tasks. The `task` is part of the embedding cache key
 * (§5 EmbeddingCacheKey) so we never reuse a document encoding for a
 * query and vice versa.
 */
export type EmbeddingTask = "document" | "query";

/**
 * An `Embedding` is a single vector plus the metadata needed to use it.
 *
 * `vector` is a `Float32Array`, never `number[]`. The
 * `BruteForceIndex` reads it directly; no conversion happens at the
 * boundary.
 *
 * `dimensions` is stored alongside the vector so the index can validate
 * dimensionality on `upsert` without re-measuring the array.
 */
export interface Embedding {
  readonly id: EmbeddingId;
  readonly vector: Float32Array;
  readonly model: string;
  readonly dimensions: number;
}
