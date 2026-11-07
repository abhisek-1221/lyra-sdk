import type { ContextChunk } from "../../types/index.js";
import type { ContextOrdering } from "../strategies.js";

/**
 * Order chunks by `(documentId, span.start)`. Documents are
 * grouped by `documentId` lexicographically, and each
 * document's chunks appear in span order.
 */
export class SourceOrderOrdering implements ContextOrdering {
  public readonly name = "source";

  public order(chunks: readonly ContextChunk[]): readonly ContextChunk[] {
    return [...chunks].sort((a, b) => {
      const docCmp = String(a.documentId).localeCompare(String(b.documentId));
      if (docCmp !== 0) return docCmp;
      return a.span.start - b.span.start;
    });
  }
}
