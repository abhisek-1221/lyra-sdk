import type { Chunk } from "@lyra-sdk/storage";

/**
 * A `ParentResolver` picks the "parent" chunk from a group of
 * sibling chunks. Different resolvers give different "what is
 * the parent" semantics.
 *
 * Phase 2 ships one implementation:
 *   - `LongestSpanParentResolver` — pick the chunk with the
 *     largest span (`end - start`) in the group. This is a
 *     robust default: the largest span is the most general
 *     chunk, which is usually the most useful parent.
 *
 * Phase 3+ may add:
 *   - `EarliestSpanParentResolver` — pick the chunk that starts
 *     earliest in the document. Useful for chapter-like
 *     structures.
 *   - `ContextualParentResolver` — pick based on the chunk's
 *     metadata (e.g. "this is a section header").
 */
export interface ParentResolver {
  /**
   * Pick the parent from a group of siblings.
   *
   * @param chunk  the original child chunk (fallback if the group is empty)
   * @param group  the sibling chunks (the original chunk is NOT included;
   *               the caller has filtered it out)
   */
  resolve(chunk: Chunk, group: readonly Chunk[]): Chunk;
}

/**
 * The default `ParentResolver`: pick the sibling with the
 * largest span (`end - start`). The original child is returned
 * as a fallback when the group is empty.
 */
export class LongestSpanParentResolver implements ParentResolver {
  public resolve(chunk: Chunk, group: readonly Chunk[]): Chunk {
    if (group.length === 0) return chunk;
    let best = group[0]!;
    let bestSpan = best.span.end - best.span.start;
    for (let i = 1; i < group.length; i++) {
      const s = group[i]!;
      const span = s.span.end - s.span.start;
      if (span > bestSpan) {
        best = s;
        bestSpan = span;
      }
    }
    return best;
  }
}
