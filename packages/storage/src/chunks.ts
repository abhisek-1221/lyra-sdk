import type { ChunkId, DocumentId, TextSpan } from "@lyra-sdk/kernel";

/**
 * A `Chunk` is a span-first reference to a region of a `SourceDocument`.
 * It carries NO content field — content is derived on demand by a
 * `ChunkContentResolver` (see `@lyra-sdk/ingestion`).
 *
 * Why no `content`:
 *   - Avoids duplicate storage (the chunk's text is exactly
 *     `document.content.slice(span.start, span.end)`).
 *   - Citations, highlighting, streaming, and parent retrieval all
 *     naturally operate on spans, not on duplicated strings.
 *   - When the source document is updated, the chunk is automatically
 *     up to date — there is no stale cached string to invalidate.
 */
export interface Chunk {
  readonly id: ChunkId;
  readonly documentId: DocumentId;
  readonly span: TextSpan;
  readonly metadata: Readonly<Record<string, string | number | boolean>>;
}
