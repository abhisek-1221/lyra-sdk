import type { ScoredChunk } from "@lyra-sdk/retrieval";

/**
 * Optional per-call configuration for a `Reranker.rerank` invocation.
 * The base contract carries only an optional name; concrete rerankers
 * extend with their own tunables (e.g. `MMRRerankerOptions`).
 */
export interface RerankerOptions {
  /** Optional name for benchmark reports and logs. */
  readonly name?: string;
  /**
   * Optional per-candidate texts, supplied by the caller. Rerankers
   * that need text (cross-encoder rerankers) read this; rerankers
   * that don't need it (MMR, threshold filters) ignore it. The
   * array MUST be the same length and order as the candidates.
   *
   * Lyra's `ScoredChunk` carries span-only chunks with no `text`
   * field, so the application is responsible for resolving the
   * text once and threading it through.
   */
  readonly texts?: readonly string[];
}

/**
 * The structured return of a `Reranker.rerank` call.
 *
 * - `results` is the reranked, possibly-filtered list of candidates.
 *   Same `ScoredChunk` instances that came in, reordered and possibly
 *   dropped. A reranker MUST NOT mutate any candidate.
 * - `durationMs` is wall-clock duration in milliseconds. Used by the
 *   pipeline for observability and per-stage latency reporting.
 * - `diagnostics` is a free-form map of per-reranker metrics. The
 *   shape is NOT stable; each reranker documents its own keys.
 *
 * The free-form diagnostics field lets each reranker evolve
 * observability independently (e.g. MMR emits `mmrScores`, cascade
 * emits `perStageDuration`) without breaking API compatibility.
 */
export interface RerankResult {
  readonly results: readonly ScoredChunk[];
  readonly durationMs: number;
  readonly diagnostics?: Readonly<Record<string, unknown>>;
}
