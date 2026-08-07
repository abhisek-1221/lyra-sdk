import type { ContextChunk } from "../../types/index.js";
import type { Deduplicator } from "../strategies.js";

/**
 * Drops exact duplicates: same `chunkId` and same span. O(n)
 * via a hash set. Always safe; runs first in the default
 * deduplicator chain.
 */
export class ExactDeduplicator implements Deduplicator {
  public readonly name = "exact";

  public deduplicate(chunks: readonly ContextChunk[]): readonly ContextChunk[] {
    const seen = new Set<string>();
    const out: ContextChunk[] = [];
    for (const c of chunks) {
      const key = `${String(c.chunkId)}:${c.span.start}:${c.span.end}`;
      if (seen.has(key)) continue;
      seen.add(key);
      out.push(c);
    }
    return out;
  }
}
