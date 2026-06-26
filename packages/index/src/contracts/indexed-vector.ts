import type { ChunkId } from "@lyra-sdk/kernel";

/**
 * The minimum information the vector index stores per entry:
 * a chunk id and a `Float32Array` vector.
 *
 * The index is **not** a chunk store. It does not know the chunk's
 * content, its document, or its metadata. The retriever resolves
 * ids back to `Chunk` objects via the `ChunkRepository` (§6.6).
 *
 * Storing only `{ id, vector }` is what lets `BruteForceIndex`,
 * `SQLiteVecIndex`, `PgVectorIndex`, and `QdrantIndex` all share the
 * same `VectorIndex` contract (Liskov). If the brute-force
 * implementation deviated from that shape — by stashing a `Chunk` —
 * the retriever would couple to the implementation.
 */
export interface IndexedVector {
  readonly id: ChunkId;
  readonly vector: Float32Array;
}

/**
 * A single search hit, as returned by `VectorIndex.search`. The index
 * does not resolve ids to `Chunk` objects; the retriever does that.
 */
export interface SearchHit {
  readonly id: ChunkId;
  readonly score: number;
}

/**
 * Backend-agnostic observability surface for any `VectorIndex`
 * implementation. Mirrors the shape that sqlite-vec, Qdrant, and
 * pgvector expose natively, so observability code can be
 * backend-agnostic.
 */
export interface IndexStats {
  /** Number of vectors currently stored. */
  readonly vectors: number;
  /** Vector dimensionality (0 if empty). */
  readonly dimensions: number;
  /** Approximate memory usage in bytes, including per-vector overhead. */
  readonly memoryUsage: number;
}
