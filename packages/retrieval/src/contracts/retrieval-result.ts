import type { Chunk } from "@lyra-sdk/storage";

/**
 * A `ScoredChunk` is a `Chunk` paired with the relevance score the
 * retriever assigned it. The score is in the metric's native range
 * (cosine: [-1, 1], dot: unbounded, Euclidean: (-∞, 0]).
 *
 * `embedding` is the vector the retriever used to score the chunk,
 * when available. Phase 3 rerankers (MMR, cross-encoder combination)
 * consume this directly to avoid re-embedding. It is **optional**
 * because:
 *   - Lexical retrievers (BM25) do not produce embeddings.
 *   - Composed retrievers may pass through a child that did not
 *     populate it.
 *
 * When `embedding` is absent and a reranker requires it (MMR), the
 * reranker throws `KernelError("invalid_argument", ...)`. Rerankers
 * never re-embed; the retriever is the sole producer.
 */
export interface ScoredChunk {
  readonly chunk: Chunk;
  readonly score: number;
  readonly embedding?: Float32Array;
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
