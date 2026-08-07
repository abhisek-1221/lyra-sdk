import { KernelError } from "@lyra-sdk/kernel";
import type { Chunk, DocumentRepository } from "@lyra-sdk/storage";
import type { ChunkContentResolver } from "../chunk-content-resolver.js";

/**
 * The default `ChunkContentResolver`. Reads each chunk's source
 * `SourceDocument` from the supplied `DocumentRepository` and slices
 * `SourceDocument.content` at the chunk's `TextSpan`.
 *
 * The resolver looks up each document **at most once** across a
 * `resolveMany` call (caching by `DocumentId` in a local `Map`), so a
 * batch of 1,000 chunks belonging to 5 documents performs 5 repository
 * reads, not 1,000.
 *
 * If a chunk references a document the repository does not have, the
 * resolver throws a `KernelError("not_found", …)`. This is a hard
 * failure — there is no silent fallback to an empty string.
 */
export class SpanChunkContentResolver implements ChunkContentResolver {
  constructor(private readonly documents: DocumentRepository) {}

  public async resolve(chunk: Chunk): Promise<string> {
    const doc = await this.documents.get(chunk.documentId);
    if (doc === null) {
      throw new KernelError("not_found", `SourceDocument not found for chunk ${chunk.id}`);
    }
    return doc.content.slice(chunk.span.start, chunk.span.end);
  }

  public async resolveMany(chunks: readonly Chunk[]): Promise<readonly string[]> {
    if (chunks.length === 0) return [];
    const cache = new Map<string, string>();
    const out: string[] = new Array(chunks.length);
    for (let i = 0; i < chunks.length; i++) {
      const chunk = chunks[i]!;
      let content = cache.get(chunk.documentId);
      if (content === undefined) {
        const doc = await this.documents.get(chunk.documentId);
        if (doc === null) {
          throw new KernelError("not_found", `SourceDocument not found for chunk ${chunk.id}`);
        }
        content = doc.content;
        cache.set(chunk.documentId, content);
      }
      out[i] = content.slice(chunk.span.start, chunk.span.end);
    }
    return out;
  }
}
