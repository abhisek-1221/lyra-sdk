import type { ContextChunk } from "../../types/index.js";
import type { Deduplicator } from "../strategies.js";

/**
 * Merges adjacent chunks in the same document, where the spans
 * are consecutive (the start of the next chunk equals the end of
 * the previous). The merged chunk keeps the first chunk's score
 * and the union of spans, with text concatenated by a single
 * space. The absorbed chunks' citations are collected into
 * `mergedCitations` so attribution survives the merge.
 *
 * Note: this is a *span* adjacency merge, not a transcript
 * utterance merge. Transcript-specific merging is in the
 * `TranscriptExpander` (Sprint 11).
 */
export class AdjacentMerger implements Deduplicator {
  public readonly name = "adjacent";

  public deduplicate(chunks: readonly ContextChunk[]): readonly ContextChunk[] {
    if (chunks.length === 0) return [];
    // Sort by (documentId, span.start) for adjacency detection.
    const sorted = [...chunks].sort((a, b) => {
      const docCmp = String(a.documentId).localeCompare(String(b.documentId));
      if (docCmp !== 0) return docCmp;
      return a.span.start - b.span.start;
    });
    const out: ContextChunk[] = [];
    let current: ContextChunk = sorted[0]!;
    for (let i = 1; i < sorted.length; i++) {
      const next = sorted[i]!;
      const sameDoc = current.documentId === next.documentId;
      const endEqualsStart = current.span.end === next.span.start;
      if (sameDoc && endEqualsStart) {
        current = {
          ...current,
          span: { start: current.span.start, end: next.span.end, sourceId: current.span.sourceId },
          text: `${current.text} ${next.text}`,
          mergedCitations: [
            ...(current.mergedCitations ?? []),
            next.citation,
            ...(next.mergedCitations ?? []),
          ],
        };
        if (next.timestamp !== undefined) {
          current = { ...current, timestamp: next.timestamp };
        }
      } else {
        out.push(current);
        current = next;
      }
    }
    out.push(current);
    return out;
  }
}
