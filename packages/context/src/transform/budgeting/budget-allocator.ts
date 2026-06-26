import type { ContextChunk } from "../../types/index.js";
import type { TokenCounter } from "./token-counter.js";
import type { TokenBudget } from "./token-budget.js";

/**
 * Walks a `ContextChunk[]` in order, accumulating tokens until
 * the budget is exhausted. Drops the overflow.
 *
 * The caller controls the input order (via `ContextOrdering`).
 * The allocator is a pure projection: it does not reorder or
 * compress.
 */
export class BudgetAllocator {
  private readonly counter: TokenCounter;
  private readonly budget: TokenBudget;

  constructor(opts: { counter: TokenCounter; budget: TokenBudget }) {
    this.counter = opts.counter;
    this.budget = opts.budget;
  }

  public allocate(
    chunks: readonly ContextChunk[],
  ): { readonly included: readonly ContextChunk[]; readonly truncated: boolean; readonly usedTokens: number } {
    const cap = this.budget.effective();
    const out: ContextChunk[] = [];
    let used = 0;
    for (const c of chunks) {
      const t = this.counter.count(c.text);
      if (used + t > cap) {
        return { included: out, truncated: true, usedTokens: used };
      }
      out.push(c);
      used += t;
    }
    return { included: out, truncated: false, usedTokens: used };
  }
}
