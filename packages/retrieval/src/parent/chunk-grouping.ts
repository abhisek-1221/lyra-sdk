import type { ChunkId } from "@lyra-sdk/kernel";
import type { Chunk, DocumentRepository, DocumentBlock } from "@lyra-sdk/storage";

/**
 * A `ChunkGrouping` defines which chunks are "siblings" of a
 * given chunk — i.e. which chunks belong to the same parent
 * region. Different groupings give different "parent" semantics.
 *
 * Phase 2 ships one implementation:
 *   - `DocumentSiblingGrouping` — siblings are all chunks in
 *     the same document.
 *
 * Phase 3+ may add:
 *   - `ParagraphGrouping` — siblings are chunks in the same
 *     paragraph (requires paragraph metadata on chunks).
 *   - `ChapterGrouping` — siblings are chunks in the same
 *     chapter.
 *   - `SlidingWindowGrouping` — siblings are the N chunks
 *     immediately before and after.
 */
export interface ChunkGrouping {
  /**
   * Return the sibling chunks of the given chunk, **excluding
   * the chunk itself**. The returned `Chunk[]` is the input to
   * the configured `ParentResolver`.
   *
   * Implementation contract: the returned chunks MUST be
   * span-only (no content field), as defined by the `Chunk`
   * contract. The parent resolver uses spans only.
   */
  siblings(chunk: Chunk, repository: DocumentRepository): Promise<readonly Chunk[]>;
}

/**
 * The Phase 2 default: siblings are all chunks in the same
 * document. This is the coarsest grouping but it is the right
 * default because it requires no chunk-level metadata
 * (paragraph, chapter, etc.) that the chunk strategy does not
 * produce today.
 *
 * The implementation reads the document's `blocks` field. Each
 * block's `metadata.chunkId` carries the chunk id (set by
 * `TranscriptParser` in Phase 1). The corresponding span is
 * reconstructed by offsetting into the document's content:
 * the block's `text` length gives the span length, and the
 * running cursor tracks the start offset.
 *
 * Why not look up chunks via `ChunkRepository`? The parent
 * retriever does not have a `ChunkRepository` dependency in
 * Phase 2's simplified shape; the document is sufficient for
 * reconstructing sibling spans. Sprint 5 adds an optional
 * `ChunkRepository` dependency for production use.
 */
export class DocumentSiblingGrouping implements ChunkGrouping {
  public async siblings(chunk: Chunk, repository: DocumentRepository): Promise<readonly Chunk[]> {
    const doc = await repository.get(chunk.documentId);
    if (doc === null) return [];
    const out: Chunk[] = [];
    let cursor = 0;
    for (const block of doc.blocks as readonly DocumentBlock[]) {
      const start = cursor;
      const end = cursor + block.text.length;
      const blockChunkId = block.metadata["chunkId"];
      if (typeof blockChunkId === "string" && blockChunkId !== (chunk.id as string)) {
        out.push({
          id: blockChunkId as ChunkId,
          documentId: chunk.documentId,
          span: { sourceId: chunk.documentId, start, end },
          metadata: block.metadata,
        });
      }
      cursor = end;
    }
    return out;
  }
}
