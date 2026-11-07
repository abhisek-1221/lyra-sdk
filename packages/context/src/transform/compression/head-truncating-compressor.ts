import type { ContextChunk } from "../../types/index.js";
import type { Compressor } from "../strategies.js";

/**
 * Keeps the head of each chunk that exceeds `maxChars` and
 * appends `...`. The source `span` stays the original range;
 * `text` is the display string.
 *
 * Use this for a hard character cap. Token-budget truncation
 * lives in `BudgetAllocator`, which shortens only the marginal
 * chunk and does not append an ellipsis.
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
      return { ...c, text: truncated };
    });
  }
}
