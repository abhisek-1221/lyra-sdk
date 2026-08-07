/**
 * A `TextSpan` is a half-open character offset pair over a `SourceDocument.content`.
 *
 * Spans are the only thing passed between the parser, the chunk strategy,
 * and the content resolver. The document string itself is never sliced
 * until a `ChunkContentResolver` materializes a chunk's text on demand.
 *
 * This keeps intermediate stages free of string allocations and is the
 * foundation of the span-first architecture called out in `arch.md §Memory`.
 */
export interface TextSpan {
  /** Owning document. */
  readonly sourceId: import("./ids.js").DocumentId;
  /** Inclusive character offset. */
  readonly start: number;
  /** Exclusive character offset. `end > start` is enforced by construction. */
  readonly end: number;
}
