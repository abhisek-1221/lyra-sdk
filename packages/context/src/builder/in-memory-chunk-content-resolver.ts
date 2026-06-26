import type { TextSpan } from "@lyra-sdk/kernel";
import type { Chunk } from "@lyra-sdk/storage";
import type { ChunkContentResolver } from "@lyra-sdk/ingestion";
import type { SourceDocument } from "@lyra-sdk/storage";

/**
 * An in-memory chunk content resolver backed by a
 * `Map<DocumentId, SourceDocument>`. Used by the default
 * `ContextBuilder`. The application supplies the map; the
 * resolver slices `document.content` on demand.
 *
 * The resolver caches nothing: it slices fresh on every call.
 * The application is responsible for memoization if it needs
 * it. Phase 3 is small-data; the slice cost is negligible.
 */
export class InMemoryChunkContentResolver implements ChunkContentResolver {
  private readonly docs: Map<string, SourceDocument>;

  constructor(documents: ReadonlyMap<string, SourceDocument>) {
    this.docs = new Map(documents);
  }

  async resolve(chunk: Chunk): Promise<string> {
    const doc = this.docs.get(String(chunk.documentId));
    if (doc === undefined) {
      throw new Error(
        `InMemoryChunkContentResolver: document ${String(chunk.documentId)} not found`,
      );
    }
    return sliceContent(doc.content, chunk.span);
  }

  async resolveMany(chunks: readonly Chunk[]): Promise<readonly string[]> {
    return Promise.all(chunks.map((c) => this.resolve(c)));
  }
}

function sliceContent(content: string, span: TextSpan): string {
  return content.slice(span.start, span.end);
}
