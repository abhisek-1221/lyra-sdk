import type { ContextChunk } from "../../types/index.js";
import type { ContextOrdering } from "../strategies.js";

/**
 * Order chunks by `SourceDocument.metadata.createdAt` ascending.
 * Multi-document corpora with explicit creation timestamps.
 * Chunks without a parseable timestamp fall to the end, in
 * input order.
 */
export class ChronologicalOrdering implements ContextOrdering {
  public readonly name = "chronological";

  constructor(private readonly createdAt: (documentId: string) => number | undefined) {}

  public order(chunks: readonly ContextChunk[]): readonly ContextChunk[] {
    const stamp = (c: ContextChunk): number =>
      this.createdAt(String(c.documentId)) ?? Number.POSITIVE_INFINITY;
    return [...chunks].sort((a, b) => {
      const sa = stamp(a);
      const sb = stamp(b);
      if (sa !== sb) return sa - sb;
      return String(a.chunkId).localeCompare(String(b.chunkId));
    });
  }
}
