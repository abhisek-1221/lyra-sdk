import type { ContextChunk } from "../../types/index.js";
import type { Compressor } from "../strategies.js";

/**
 * Truncates the head of the last chunk to fit a fixed character
 * budget. Keeps the chunk's metadata and citation; only the
 * text is shortened. The `span.end` is updated to reflect the
 * truncated text length.
 *
 * Use this for hard caps (e.g. "no more than 8000 chars in the
 * last chunk"). For a token-aware version, use the budget
 * allocator before the compressor.
 */
export class HeadTruncatingCompressor implements Compressor {
  public readonly name = "head-truncating";

  constructor(private readonly maxChars: number) {
    if (!Number.isInteger(maxChars) || maxChars <= 0) {
      throw new Error(`HeadTruncatingCompressor: maxChars must be a positive integer, got ${maxChars}`);
    }
  }

  public compress(chunks: readonly ContextChunk[]): readonly ContextChunk[] {
    return chunks.map((c) => {
      if (c.text.length <= this.maxChars) return c;
      const truncated = `${c.text.slice(0, this.maxChars)}...`;
      const start = c.span.start;
      const newEnd = Math.min(c.span.end, start + truncated.length);
      return { ...c, text: truncated, span: { start, end: newEnd, sourceId: c.span.sourceId } };
    });
  }
}
