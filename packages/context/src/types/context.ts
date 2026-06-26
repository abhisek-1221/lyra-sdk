import type { ContextChunk, ContextCitation } from "./context-chunk.js";

/**
 * The output of a `ContextBuilder.build` call. Everything is
 * deeply `readonly`; the builder does not mutate the result.
 */
export interface Context {
  /** Resolved, ordered, deduplicated, budget-respecting chunks. */
  readonly chunks: readonly ContextChunk[];
  /**
   * Citations keyed by `ContextCitation.key`, in citation order.
   * The order matches the chunk order: chunk `i` cites
   * `citations[i]` after dedup.
   */
  readonly citations: readonly ContextCitation[];
  /** Tokens consumed by `chunks` (per the supplied `TokenCounter`). */
  readonly usedTokens: number;
  /** Effective token budget. */
  readonly tokenBudget: number;
  /** True if any candidate was dropped or truncated. */
  readonly truncated: boolean;
  /** Per-stage timings for benchmarking. */
  readonly diagnostics: Readonly<Record<string, number>>;
}
