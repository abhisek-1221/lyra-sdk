/**
 * @lyra-sdk/retrieval
 *
 * Retriever contract and the Phase 1 `DenseRetriever`. The package is
 * the read side of the runtime: it takes a query, an embedder, an
 * index, and a chunk repository, and returns a `RetrievalResult`.
 *
 * It does not know about ingest, parsers, chunk strategies, or the
 * pipeline. Those belong to `@lyra-sdk/ingestion` and
 * `@lyra-sdk/pipeline`.
 *
 * @packageDocumentation
 */

export type { Retriever } from "./contracts/retriever.js";
export type { RetrievalResult, ScoredChunk } from "./contracts/retrieval-result.js";

export type { DenseRetrieverOptions } from "./dense/dense-retriever.js";
export { DenseRetriever } from "./dense/dense-retriever.js";
