import { createChunkId, type ChunkId, type DocumentId, type TextSpan } from "@lyra-sdk/kernel";
import type { Chunk, DocumentBlock, SourceDocument } from "@lyra-sdk/storage";

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

interface BlockRange {
  readonly contentStart: number;
  readonly contentEnd: number;
  readonly offset?: number;
  readonly speaker?: string;
}

/**
 * Copy transcript timing onto chunks.
 *
 * A block contributes when its metadata has numeric `contentStart`
 * and `contentEnd` (character offsets into `SourceDocument.content`,
 * half-open). Each chunk receives the `offset` of the earliest
 * overlapping block as `metadata.timestamp`, in seconds. A string
 * `speaker` on that same block is copied through. Blocks without
 * content offsets are ignored, and a document with none of them
 * leaves the chunk list unchanged.
 */
export function projectChunkMetadata(
  document: SourceDocument,
  chunks: readonly Chunk[],
): readonly Chunk[] {
  const ranges = blockRanges(document.blocks);
  if (ranges.length === 0) return chunks;
  return chunks.map((chunk) => {
    let earliest: BlockRange | undefined;
    for (const range of ranges) {
      const overlaps = range.contentStart < chunk.span.end && range.contentEnd > chunk.span.start;
      if (!overlaps) continue;
      if (earliest === undefined || range.contentStart < earliest.contentStart) earliest = range;
    }
    if (earliest === undefined) return chunk;
    const metadata: Record<string, string | number | boolean> = { ...chunk.metadata };
    let changed = false;
    if (typeof earliest.offset === "number") {
      metadata.timestamp = earliest.offset;
      changed = true;
    }
    if (typeof earliest.speaker === "string") {
      metadata.speaker = earliest.speaker;
      changed = true;
    }
    if (!changed) return chunk;
    return { ...chunk, metadata };
  });
}

function blockRanges(blocks: readonly DocumentBlock[]): readonly BlockRange[] {
  const out: BlockRange[] = [];
  for (const block of blocks) {
    const contentStart = block.metadata["contentStart"];
    const contentEnd = block.metadata["contentEnd"];
    if (typeof contentStart !== "number" || typeof contentEnd !== "number") continue;
    const offset = block.metadata["offset"];
    const speaker = block.metadata["speaker"];
    out.push({
      contentStart,
      contentEnd,
      ...(typeof offset === "number" ? { offset } : {}),
      ...(typeof speaker === "string" ? { speaker } : {}),
    });
  }
  return out;
}
