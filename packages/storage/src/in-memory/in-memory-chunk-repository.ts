import type { ChunkId } from "@lyra-sdk/kernel";
import type { Chunk } from "../chunks.js";
import type { ChunkRepository } from "../contracts/chunk-repository.js";

/**
 * In-memory `ChunkRepository`. Phase 1 only.
 *
 * Backed by a `Map<ChunkId, Chunk>`. All operations are O(1) or O(n) on
 * the input batch size. No persistence, no transactions, no concurrency
 * controls — if you need those, use SQLite or Postgres (Phase 2).
 */
export class InMemoryChunkRepository implements ChunkRepository {
  private readonly store = new Map<ChunkId, Chunk>();

  public async save(chunks: readonly Chunk[]): Promise<void> {
    for (const c of chunks) {
      this.store.set(c.id, c);
    }
  }

  public async get(id: ChunkId): Promise<Chunk | null> {
    return this.store.get(id) ?? null;
  }

  public async getMany(ids: readonly ChunkId[]): Promise<readonly (Chunk | null)[]> {
    return ids.map((id) => this.store.get(id) ?? null);
  }

  public async delete(id: ChunkId): Promise<void> {
    this.store.delete(id);
  }

  public size(): number {
    return this.store.size;
  }

  public dispose(): void {
    this.store.clear();
  }
}
