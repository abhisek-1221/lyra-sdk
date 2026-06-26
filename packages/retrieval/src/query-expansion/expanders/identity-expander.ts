import type { QueryExpander } from "../query-expander.js";

/**
 * The no-op expander. Returns `[query]` — the original, unchanged.
 *
 * Useful as a baseline and as a default when no expansion is
 * desired but the public API expects an expander.
 */
export class IdentityExpander implements QueryExpander {
  public readonly name = "identity";

  public async expand(query: string): Promise<readonly string[]> {
    return [query];
  }
}
