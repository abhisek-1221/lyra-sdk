import type { ScoredChunk } from "@lyra-sdk/retrieval";
import type { Context, ContextChunk } from "../types/index.js";
import type { TokenCounter } from "../transform/budgeting/index.js";

/**
 * Per-call overrides for {@link ContextBuilder.build}.
 * Omitted fields fall back to the builder's constructor options.
 */
export interface ContextBuildOptions {
  /** The user query. Recorded for diagnostics and available to strategies. */
  readonly query?: string;
  /** Overrides the constructor token budget for this call. */
  readonly tokenBudget?: number;
  /**
   * Tokens already committed to system text, history, the query,
   * and the prompt wrapper. Subtracted from the context cap.
   */
  readonly promptOverheadTokens?: number;
  /**
   * Tokens for one rendered chunk, including its citation marker
   * and header. The default counts `text` only.
   */
  readonly countChunkTokens?: (chunk: ContextChunk, counter: TokenCounter) => number;
  /**
   * Separator inserted between rendered chunks. Counted with the
   * builder's own `TokenCounter`.
   */
  readonly joinWith?: string;
  /**
   * Extra tokens that depend on the selected set, such as a
   * source footer. Applied after selection and may drop the
   * lowest-scoring chunk until the set fits.
   */
  readonly countExtras?: (chunks: readonly ContextChunk[], counter: TokenCounter) => number;
}

/**
 * The public contract for assembling a prompt-ready `Context`
 * from a list of `ScoredChunk`s. The builder resolves content
 * (via a `ChunkContentResolver` supplied internally by the
 * concrete builder), applies the configured transforms, and
 * returns a `Context` with a token estimate.
 *
 * The builder is **deterministic** with respect to its inputs
 * and configuration. The application is responsible for any
 * concurrency, memoization, or warm-up.
 */
export interface ContextBuilder {
  readonly name: string;
  build(chunks: readonly ScoredChunk[], options?: ContextBuildOptions): Promise<Context>;
}
