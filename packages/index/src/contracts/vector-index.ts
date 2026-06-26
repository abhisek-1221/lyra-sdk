import type { ChunkId } from "@lyra-sdk/kernel";
import type { IndexedVector, IndexStats, SearchHit } from "./indexed-vector.js";

/**
 * The vector index contract. Backend-agnostic.
 *
 * Implementations MUST:
 *   - Treat `upsert` as upsert: an existing entry with the same `id` is
 *     overwritten. The contract is silent on the case where the
 *     incoming vector has different `dimensions` than an existing
 *     entry with the same id; implementations should reject it.
 *   - Treat `delete` as idempotent.
 *   - Return `SearchHit[]` in **descending score order** (best match
 *     first). Ties may be broken arbitrarily.
 *   - Return at most `k` hits. If the index has fewer than `k` vectors,
 *     all of them are returned.
 */
export interface VectorIndex {
  upsert(items: readonly IndexedVector[]): Promise<void>;
  search(query: Float32Array, k: number): Promise<readonly SearchHit[]>;
  delete(id: ChunkId): Promise<void>;
  stats(): IndexStats;
}
