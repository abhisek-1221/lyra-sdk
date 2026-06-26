import { KernelError } from "@lyra-sdk/kernel";
import type { ChunkId } from "@lyra-sdk/kernel";
import type { VectorIndex } from "../contracts/vector-index.js";
import type { IndexedVector, IndexStats, SearchHit } from "../contracts/indexed-vector.js";
import type { SimilarityMetric } from "../similarity/similarity-metric.js";

/**
 * The Phase 1 in-memory `VectorIndex`. `O(n · d)` per `search`. Fast
 * enough for the first 100k vectors; swap for an HNSW-backed index
 * (Phase 2) when the dataset outgrows brute force.
 *
 * The index stores only `{ id, vector }` — no chunks, no metadata.
 * The retriever resolves ids back to `Chunk` objects via the
 * `ChunkRepository`.
 */
export class BruteForceIndex implements VectorIndex {
  private readonly store = new Map<ChunkId, Float32Array>();
  private readonly metric: SimilarityMetric;
  private dimensions = 0;

  constructor(metric: SimilarityMetric) {
    this.metric = metric;
  }

  public async upsert(items: readonly IndexedVector[]): Promise<void> {
    for (const item of items) {
      const existing = this.store.get(item.id);
      if (existing !== undefined && existing.length !== item.vector.length) {
        throw new KernelError(
          "invalid_argument",
          `BruteForceIndex: cannot change dimensionality of an existing entry (id=${item.id}, was ${existing.length}, now ${item.vector.length})`,
        );
      }
      this.store.set(item.id, item.vector);
      this.dimensions = item.vector.length;
    }
  }

  public async search(query: Float32Array, k: number): Promise<readonly SearchHit[]> {
    if (k <= 0) return [];
    if (this.store.size === 0) return [];
    if (this.dimensions !== 0 && query.length !== this.dimensions) {
      throw new KernelError(
        "invalid_argument",
        `BruteForceIndex: query dimensions (${query.length}) do not match index dimensions (${this.dimensions})`,
      );
    }
    const hits: SearchHit[] = [];
    for (const [id, vec] of this.store) {
      hits.push({ id, score: this.metric.score(query, vec) });
    }
    // Descending score order. Ties broken by id (string compare) for
    // determinism.
    hits.sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
    });
    return hits.slice(0, k);
  }

  public async delete(id: ChunkId): Promise<void> {
    this.store.delete(id);
  }

  public stats(): IndexStats {
    let bytes = 0;
    for (const v of this.store.values()) {
      bytes += v.byteLength;
    }
    // Add ~40 bytes per entry for the Map node + ChunkId key. This is
    // a rough estimate; real overhead depends on the V8 hash table.
    bytes += this.store.size * 40;
    return {
      vectors: this.store.size,
      dimensions: this.dimensions,
      memoryUsage: bytes,
    };
  }
}
