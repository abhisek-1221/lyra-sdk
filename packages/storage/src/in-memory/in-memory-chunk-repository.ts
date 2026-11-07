import type { ChunkId, DocumentId } from "@lyra-sdk/kernel";
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
  private readonly byDocument = new Map<DocumentId, Set<ChunkId>>();

  public async save(chunks: readonly Chunk[]): Promise<void> {
    for (const c of chunks) {
      const prev = this.store.get(c.id);
      if (prev !== undefined) this.unlink(prev);
      this.store.set(c.id, c);
      this.link(c);
    }
  }

  public async get(id: ChunkId): Promise<Chunk | null> {
    return this.store.get(id) ?? null;
  }

  public async getMany(ids: readonly ChunkId[]): Promise<readonly (Chunk | null)[]> {
    return ids.map((id) => this.store.get(id) ?? null);
  }

  public async listByDocument(documentId: DocumentId): Promise<readonly Chunk[]> {
    const ids = this.byDocument.get(documentId);
    if (ids === undefined) return [];
    const out: Chunk[] = [];
    for (const id of ids) {
      const chunk = this.store.get(id);
      if (chunk !== undefined) out.push(chunk);
    }
    return out;
  }

  public async delete(id: ChunkId): Promise<void> {
    const prev = this.store.get(id);
    if (prev !== undefined) this.unlink(prev);
    this.store.delete(id);
  }

  public size(): number {
    return this.store.size;
  }

  public dispose(): void {
    this.store.clear();
    this.byDocument.clear();
  }

  private link(chunk: Chunk): void {
    let ids = this.byDocument.get(chunk.documentId);
    if (ids === undefined) {
      ids = new Set();
      this.byDocument.set(chunk.documentId, ids);
    }
    ids.add(chunk.id);
  }

  private unlink(chunk: Chunk): void {
    const ids = this.byDocument.get(chunk.documentId);
    if (ids === undefined) return;
    ids.delete(chunk.id);
    if (ids.size === 0) this.byDocument.delete(chunk.documentId);
  }
}
