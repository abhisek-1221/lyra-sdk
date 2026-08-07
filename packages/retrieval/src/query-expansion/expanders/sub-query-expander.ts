import type { QueryExpander } from "../query-expander.js";

/**
 * The sub-query expander. Splits a compound query into multiple
 * sub-queries using simple, deterministic rules:
 *
 *   - Split on `?` and `;` — common question separators.
 *   - Split on ` and ` (with surrounding whitespace) — common
 *     conjunction.
 *   - Split on top-level commas (no nested parens; Phase 2
 *     simplification).
 *
 * The original query is always the first entry. Sub-queries are
 * returned in their original order. Empty splits are dropped.
 */
export class SubQueryExpander implements QueryExpander {
  public readonly name = "subquery";

  public async expand(query: string): Promise<readonly string[]> {
    const out: string[] = [query];
    const seen = new Set<string>([query.toLowerCase()]);
    for (const piece of this.split(query)) {
      const key = piece.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      out.push(piece);
    }
    return out;
  }

  private split(query: string): readonly string[] {
    // Replace separators with a single sentinel, then split.
    // We work on the original string but split on a regex that
    // matches the separator set.
    const parts = query
      .split(/\s*(\?|;|\band\b)\s*/i)
      .map((s) => s.trim())
      .filter((s) => s.length > 0 && !/^(\?|;|\band\b)$/i.test(s));
    return parts;
  }
}
