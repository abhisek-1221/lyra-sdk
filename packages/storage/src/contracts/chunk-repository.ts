import type { ChunkId } from "@lyra-sdk/kernel";
import type { Chunk } from "../chunks.js";

/**
 * Persistence contract for `Chunk` records.
 *
 * `ChunkRepository` is the **only** abstraction the retrieval and
 * ingestion layers talk to. It is intentionally backend-agnostic so
 * that the in-memory implementation in Phase 1 can be replaced with
 * SQLite, Postgres, or any other store in Phase 2 without touching
 * the retriever, the index, or the pipeline.
 *
 * Implementations MUST treat `save` as upsert: an existing chunk with
 * the same `id` is overwritten. They MUST treat `delete` as idempotent:
 * deleting a non-existent id is a no-op (not an error).
 */
export interface ChunkRepository {
  /** Upsert a batch of chunks. */
  save(chunks: readonly Chunk[]): Promise<void>;
  /** Fetch one chunk by id, or `null` if absent. */
  get(id: ChunkId): Promise<Chunk | null>;
  /**
   * Fetch many chunks by id. The result length and ordering match the
   * input; ids that are not found become `null` in the result.
   */
  getMany(ids: readonly ChunkId[]): Promise<readonly (Chunk | null)[]>;
  /** Idempotent delete. */
  delete(id: ChunkId): Promise<void>;
  /** Total number of stored chunks. */
  size(): number;
  /** Release any resources (connections, file handles, timers). */
  dispose(): void;
}
