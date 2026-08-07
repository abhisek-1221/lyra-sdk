/**
 * @lyra-sdk/reranking
 *
 * Reranker contracts and implementations. Phase 3 of the RAG plan.
 *
 * Contents (added across sprints):
 *   - `Reranker`, `RerankResult`, `RerankerOptions` — base contracts
 *     (Sprint 1).
 *   - `MMRReranker` — Maximal Marginal Relevance (Sprint 2).
 *   - `CrossEncoderReranker` + Jina / Voyage / Cohere / BGE
 *     providers — fetch-only, no SDKs (Sprint 3).
 *   - `CascadeReranker` — composition of `Reranker` stages (Sprint 4).
 *
 * Rerankers consume the output of any `Retriever` and produce an
 * ordered or filtered `readonly ScoredChunk[]`. They are pure: no
 * ingest, no retrieval, no side effects, no chunk mutation.
 *
 * @packageDocumentation
 */

export type { Reranker } from "./contracts/reranker.js";
export type { RerankerOptions } from "./contracts/rerank-result.js";
export type { RerankResult } from "./contracts/rerank-result.js";

export { MMRReranker } from "./mmr/mmr-reranker.js";
export type { MMRRerankerOptions } from "./mmr/mmr-reranker.js";

export { CrossEncoderReranker } from "./cross-encoder/cross-encoder-reranker.js";
export type {
  CrossEncoderRerankerOptions,
  CrossEncoderRequest,
  CrossEncoderResponse,
} from "./cross-encoder/cross-encoder-reranker.js";
export type { CrossEncoderTransport } from "./cross-encoder/transport.js";
export { JinaReranker } from "./cross-encoder/providers/jina/index.js";
export { VoyageReranker } from "./cross-encoder/providers/voyage/index.js";
export { CohereReranker } from "./cross-encoder/providers/cohere/index.js";
export { BGEReranker } from "./cross-encoder/providers/bge/index.js";

export { CascadeReranker } from "./cascade/cascade-reranker.js";
export type { CascadeRerankerOptions } from "./cascade/cascade-reranker.js";
