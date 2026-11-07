import type { ContextChunk } from "../../types/index.js";
import type { Compressor } from "../strategies.js";

/**
 * Truncates the center of each chunk that exceeds the budget:
 * keeps the head and the tail, drops the middle. The dropped
 * middle is replaced with a single `...` separator. The source
 * `span` stays the original range; `text` is the display string.
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
      return { ...c, text: truncated };
    });
  }
}
