import type { ContextChunk, ContextCitation } from "./context-chunk.js";

/**
 * The output of a `ContextBuilder.build` call. Everything is
 * deeply `readonly`; the builder does not mutate the result.
 */
export interface Context {
  /** Resolved, ordered, deduplicated, budget-respecting chunks. */
  readonly chunks: readonly ContextChunk[];
  /**
   * Citations keyed by `ContextCitation.key`, deduped and in
   * first-seen chunk order. This is not a one-to-one mapping onto
   * `chunks`: a chunk produced by a merging transform contributes
   * its own citation plus every citation in `mergedCitations`.
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
