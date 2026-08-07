import { createChunkId, type ChunkId, type DocumentId, type TextSpan } from "@lyra-sdk/kernel";
import type { Chunk } from "@lyra-sdk/storage";

/**
 * Options for {@link ChunkFactory}.
 */
export interface ChunkFactoryOptions {
  /**
   * Function that produces a `ChunkId` from a `(documentId, span)` pair.
   * Default: a deterministic hash of the document id and span offsets,
   * so the same logical chunk produces the same id across runs.
   *
   * Override this if you need ids to be opaque (use `newChunkId` from
   * `@lyra-sdk/kernel` for UUIDs).
   */
  readonly idFor?: (documentId: DocumentId, span: TextSpan, index: number) => ChunkId;
}

const FNV_OFFSET = 0x811c9dc5;
const FNV_PRIME = 0x01000193;

/**
 * FNV-1a 32-bit hash. Used to derive deterministic chunk ids.
 *
 * Not cryptographic. Just stable and fast. Same input → same id, every
 * run, every machine.
 */
function fnv1a(parts: readonly string[]): number {
  let hash = FNV_OFFSET;
  for (const part of parts) {
    for (let i = 0; i < part.length; i++) {
      hash ^= part.charCodeAt(i);
      hash = Math.imul(hash, FNV_PRIME);
    }
  }
  return hash >>> 0;
}

function defaultIdFor(documentId: DocumentId, span: TextSpan, index: number): ChunkId {
  const h = fnv1a([documentId, String(span.start), String(span.end), String(index)]);
  return createChunkId(`c_${h.toString(36)}`);
}

/**
 * Materializes `Chunk` records from `TextSpan`s.
 *
 * The factory is the **only** stage of the ingestion pipeline that
 * allocates chunk ids. It is span-only — it never slices the document
 * content. Content is derived later by `SpanChunkContentResolver` (the
 * span-first architecture keeps string allocations out of every
 * intermediate stage).
 */
export class ChunkFactory {
  private readonly idFor: (documentId: DocumentId, span: TextSpan, index: number) => ChunkId;

  constructor(options: ChunkFactoryOptions = {}) {
    this.idFor = options.idFor ?? defaultIdFor;
  }

  public create(documentId: DocumentId, spans: readonly TextSpan[]): readonly Chunk[] {
    return spans.map((span, i) => ({
      id: this.idFor(documentId, span, i),
      documentId,
      span,
      metadata: {},
    }));
  }
}
