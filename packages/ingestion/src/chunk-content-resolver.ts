import type { DocumentId, TextSpan } from "@lyra-sdk/kernel";
import type { Chunk } from "@lyra-sdk/storage";

/**
 * A `ChunkContentResolver` derives the text of a chunk on demand.
 *
 * The runtime never stores a chunk's content. When the text is needed
 * (for embedding, display, citations, streaming), a resolver materializes
 * it. Different resolvers exist for different backing stores; the
 * default {@link SpanChunkContentResolver} reads from a
 * `DocumentRepository` and slices the source `SourceDocument.content`.
 *
 * Resolvers MUST be pure with respect to their input chunk + the
 * underlying source — calling `resolve` twice on the same chunk MUST
 * return equal strings.
 */
export interface ChunkContentResolver {
  resolve(chunk: Chunk): Promise<string>;
  resolveMany(chunks: readonly Chunk[]): Promise<readonly string[]>;
  /**
   * Slice a source document by span, without a stored chunk id.
   * Merging uses this so a resolver that looks chunks up by id is
   * not asked to read an invented id. When omitted, the merger
   * stitches the members' already-resolved text.
   */
  resolveSpan?(documentId: DocumentId, span: TextSpan): Promise<string>;
}
