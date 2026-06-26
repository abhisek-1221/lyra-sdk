import type { DocumentId } from "@lyra-sdk/kernel";
import type { SourceDocument } from "../documents.js";

/**
 * Persistence contract for `SourceDocument` records.
 *
 * Mirrors `ChunkRepository` in shape. Used by the ingestion pipeline to
 * store parsed source documents (and by the `SpanChunkContentResolver`
 * to look them up when resolving a chunk's text on demand).
 */
export interface DocumentRepository {
  /** Upsert a batch of source documents. */
  save(documents: readonly SourceDocument[]): Promise<void>;
  /** Fetch one source document by id, or `null` if absent. */
  get(id: DocumentId): Promise<SourceDocument | null>;
  /** Idempotent delete. */
  delete(id: DocumentId): Promise<void>;
  /** Total number of stored documents. */
  size(): number;
  /** Release any resources. */
  dispose(): void;
}
