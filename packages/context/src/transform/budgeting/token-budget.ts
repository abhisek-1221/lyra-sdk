/**
 * The token budget for a context. The effective budget is
 * `total - reservedForResponse`; the application passes both.
 */
export interface TokenBudget {
  /** Total tokens available for the LLM call. */
  readonly total: number;
  /** Reserve this many tokens for the LLM's response. */
  readonly reservedForResponse: number;
  /** Effective budget for context. `total - reservedForResponse`. */
  effective(): number;
}

export function makeTokenBudget(total: number, reservedForResponse = 0): TokenBudget {
  return {
    total,
    reservedForResponse,
    effective: () => Math.max(0, total - reservedForResponse),
  };
}
