import type { ScoredChunk } from "@lyra-sdk/retrieval";
import type { Context } from "../types/index.js";

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
  build(chunks: readonly ScoredChunk[]): Promise<Context>;
}
