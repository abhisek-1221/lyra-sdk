import type { ScoredChunk } from "@lyra-sdk/retrieval";
import type { RerankResult, RerankerOptions } from "./rerank-result.js";

/**
 * A `Reranker` reorders or filters the candidates produced by a
 * `Retriever`. It is a **pure function over a list**:
 *
 *   `(query, candidates) -> Promise<readonly ScoredChunk[]>`
 *
 * Rerankers MUST NOT:
 *   - mutate any `ScoredChunk` they receive (no text edits, no
 *     metadata edits, no citation edits).
 *   - call a `Retriever` to discover new candidates. The retriever
 *     is the sole producer of new candidates; a reranker only
 *     reorders or filters the input list.
 *   - re-embed a candidate. If a reranker needs an embedding that
 *     is missing, it throws.
 *
 * Rerankers MAY:
 *   - reorder the input list (e.g. by score, by MMR diversity).
 *   - drop candidates (e.g. cascade stages, threshold filters).
 *   - emit per-call diagnostics in `RerankResult.diagnostics`.
 */
export interface Reranker {
  /** A short identifier used in benchmark reports and logs. */
  readonly name: string;
  rerank(
    query: string,
    candidates: readonly ScoredChunk[],
    options?: RerankerOptions,
  ): Promise<RerankResult>;
}
