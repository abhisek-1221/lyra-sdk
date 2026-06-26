import type { TextSpan } from "@lyra-sdk/kernel";

/**
 * Options for {@link GreedySpanMerger}.
 */
export interface GreedySpanMergerOptions {
  /**
   * Hard cap on the merged chunk size in characters. The merger packs
   * spans greedily until adding the next span would exceed this cap;
   * the over-sized span is then rolled over to the next chunk.
   *
   * Default: 2000. Tune to your embedder's token window and your
   * tokenizer's chars-per-token ratio.
   */
  readonly chunkSize?: number;
}

/**
 * Greedy span merger. Phase 1's only merger.
 *
 * Walks the input spans in order and packs them into merged spans that
 * never exceed `chunkSize` characters. The merger preserves the
 * first/last offsets of each merged span; the consumer (typically
 * `TokenOverlapProcessor`) decides what to do with the gaps between
 * merged groups.
 *
 * The algorithm:
 *   1. Initialize `current = { start, end: start, length: 0 }`.
 *   2. For each input span:
 *      - If `current.length + span.length <= chunkSize`, extend `current.end`.
 *      - Otherwise, emit `current` as a merged span and start a new one.
 *   3. Emit the final `current` if non-empty.
 *
 * The merger never re-orders, never drops, never de-duplicates. It is
 * a single forward pass.
 */
export class GreedySpanMerger {
  private readonly chunkSize: number;

  constructor(options: GreedySpanMergerOptions = {}) {
    this.chunkSize = options.chunkSize ?? 2000;
  }

  public merge(spans: readonly TextSpan[]): readonly TextSpan[] {
    if (spans.length === 0) return [];
    const out: TextSpan[] = [];
    let currentStart = -1;
    let currentEnd = -1;
    let currentLen = 0;

    for (const span of spans) {
      const len = span.end - span.start;
      if (currentStart === -1) {
        currentStart = span.start;
        currentEnd = span.end;
        currentLen = len;
        continue;
      }
      // Adjacent spans abut, so we can use span.start directly.
      if (currentLen + len <= this.chunkSize) {
        currentEnd = span.end;
        currentLen += len;
      } else {
        out.push({ sourceId: spans[0]!.sourceId, start: currentStart, end: currentEnd });
        currentStart = span.start;
        currentEnd = span.end;
        currentLen = len;
      }
    }
    if (currentStart !== -1) {
      out.push({ sourceId: spans[0]!.sourceId, start: currentStart, end: currentEnd });
    }
    return out;
  }
}
