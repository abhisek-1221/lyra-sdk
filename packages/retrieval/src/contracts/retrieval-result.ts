import type { Chunk } from "@lyra-sdk/storage";

/**
 * A `ScoredChunk` is a `Chunk` paired with the relevance score the
 * retriever assigned it. The score is in the metric's native range
 * (cosine: [-1, 1], dot: unbounded, Euclidean: (-∞, 0]).
 */
export interface ScoredChunk {
  readonly chunk: Chunk;
  readonly score: number;
}

/**
 * The output of a `Retriever.retrieve` call.
 *
 * - `query` is the original query string, echoed back for the caller's
 *   convenience (citation, logging).
 * - `results` is the ordered list of `ScoredChunk`s, best match first.
 * - `durationMs` is wall-clock duration in milliseconds. Used by the
 *   pipeline to surface per-call latency to observability hooks.
 */
export interface RetrievalResult {
  readonly query: string;
  readonly results: readonly ScoredChunk[];
  readonly durationMs: number;
}
