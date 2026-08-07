import type { Context } from "@lyra-sdk/context";
import type { RetrievalResult, ScoredChunk } from "@lyra-sdk/retrieval";

/**
 * The result of a `RetrievalPipeline.query` call. Holds the
 * untouched Phase 2 `RetrievalResult` plus the reranked
 * candidates and the assembled `Context`.
 *
 * Three concerns, three fields, three independent contracts:
 *   - `retrieval` is the unchanged `RetrievalResult` from the
 *     underlying `Retriever`. The retrieval package is not
 *     modified; the same 63 tests pass.
 *   - `reranked` is the post-rerank array (or the same as
 *     `retrieval.results` when no reranker is configured).
 *   - `context` is the assembled `Context` (or an empty
 *     `Context` when no builder is configured).
 */
export interface PipelineResult {
  readonly retrieval: RetrievalResult;
  readonly reranked: readonly ScoredChunk[];
  readonly context: Context;
}

/**
 * Build an empty `Context` for pipelines that have no
 * `ContextBuilder` configured. The shape is documented and
 * stable; tests assert it.
 */
export function emptyContext(): Context {
  return {
    chunks: [],
    citations: [],
    usedTokens: 0,
    tokenBudget: 0,
    truncated: false,
    diagnostics: {},
  };
}
