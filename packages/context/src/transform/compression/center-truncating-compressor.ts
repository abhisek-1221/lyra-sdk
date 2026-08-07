import type { ContextChunk } from "../../types/index.js";
import type { Compressor } from "../strategies.js";

/**
 * Truncates the center of each chunk that exceeds the budget:
 * keeps the head and the tail, drops the middle. The dropped
 * middle is replaced with a single `...` separator. The
 * `span.end` is updated to reflect the new text length.
 *
 * Useful for very long single chunks that the LLM cannot
 * consume end-to-end.
 */
export class CenterTruncatingCompressor implements Compressor {
  public readonly name = "center-truncating";

  constructor(
    private readonly headChars: number,
    private readonly tailChars: number,
  ) {
    if (!Number.isInteger(headChars) || headChars < 0) {
      throw new Error(`CenterTruncatingCompressor: headChars must be a non-negative integer`);
    }
    if (!Number.isInteger(tailChars) || tailChars < 0) {
      throw new Error(`CenterTruncatingCompressor: tailChars must be a non-negative integer`);
    }
    if (headChars + tailChars <= 0) {
      throw new Error(`CenterTruncatingCompressor: headChars + tailChars must be > 0`);
    }
  }

  public compress(chunks: readonly ContextChunk[]): readonly ContextChunk[] {
    const cap = this.headChars + this.tailChars;
    return chunks.map((c) => {
      if (c.text.length <= cap + 5) return c;
      const head = c.text.slice(0, this.headChars);
      const tail = c.text.slice(c.text.length - this.tailChars);
      const truncated = `${head}...${tail}`;
      const start = c.span.start;
      const newEnd = Math.min(c.span.end, start + truncated.length);
      return { ...c, text: truncated, span: { start, end: newEnd, sourceId: c.span.sourceId } };
    });
  }
}
