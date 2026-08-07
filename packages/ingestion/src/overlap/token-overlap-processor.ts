import type { TextSpan } from "@lyra-sdk/kernel";

/**
 * Options for {@link TokenOverlapProcessor}.
 */
export interface TokenOverlapProcessorOptions {
  /**
   * Number of characters of overlap to add between adjacent merged
   * chunks. The overlap is created by **sliding the start of the next
   * chunk backward** into the end of the previous chunk.
   *
   * The overlap is best-effort: it is clamped at the start of the
   * document (chunk 0 cannot have a negative start) and at the end of
   * the document (the last chunk cannot extend past `docLength`).
   *
   * Default: 200.
   */
  readonly overlap?: number;
  /**
   * Total document length in characters. Required to clamp the last
   * chunk's overlap window.
   */
  readonly docLength: number;
}

/**
 * Token overlap processor. Phase 1's only overlap strategy.
 *
 * Given an ordered list of merged spans, produces a new list where each
 * span (after the first) is slid backward by `overlap` characters so
 * it overlaps the previous span.
 *
 * The processor never moves spans forward, never changes the
 * document-level sequence, and never produces an empty span. Spans
 * that are themselves shorter than the overlap are skipped over: we do
 * not duplicate the entire content of a tiny span as its own overlap.
 */
export class TokenOverlapProcessor {
  public addOverlap(spans: readonly TextSpan[], options: TokenOverlapProcessorOptions): readonly TextSpan[] {
    if (spans.length === 0) return [];
    const overlap = options.overlap ?? 200;
    if (overlap <= 0) return spans;
    const docLength = options.docLength;
    const out: TextSpan[] = [spans[0]!];

    for (let i = 1; i < spans.length; i++) {
      const prev = out[i - 1]!;
      const curr = spans[i]!;
      const newStart = Math.max(prev.start, curr.start - overlap);
      const newEnd = Math.min(curr.end, docLength);
      if (newEnd <= newStart) {
        // No room for an overlap window. Skip — the next chunk will
        // still abut this one in the input order.
        out.push(curr);
        continue;
      }
      out.push({ sourceId: curr.sourceId, start: newStart, end: newEnd });
    }
    return out;
  }
}
