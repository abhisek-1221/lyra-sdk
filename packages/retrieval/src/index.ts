/**
 * @lyra-sdk/retrieval
 *
 * Retriever contract and Phase 1 + Phase 2 retrievers. The package
 * is the read side of the runtime: it takes a query, returns a
 * `RetrievalResult`.
 *
 * It does not know about ingest, parsers, chunk strategies, or the
 * pipeline. Those belong to `@lyra-sdk/ingestion` and
 * `@lyra-sdk/pipeline`.
 *
 * Phase 2 adds lexical, hybrid, query-expansion, and parent
 * retrievers. Every retriever satisfies the same `Retriever`
 * contract and is fully composable.
 *
 * @packageDocumentation
 */

export type { Retriever } from "./contracts/retriever.js";
export type { RetrievalResult, ScoredChunk } from "./contracts/retrieval-result.js";

export type { DenseRetrieverOptions } from "./dense/dense-retriever.js";
export { DenseRetriever } from "./dense/dense-retriever.js";

export type { BM25RetrieverOptions } from "./lexical/bm25-retriever.js";
export { BM25Retriever } from "./lexical/bm25-retriever.js";

export type { ScoreNormalizer } from "./fusion/score-normalizer.js";
export { MinMaxScoreNormalizer, ZScoreScoreNormalizer } from "./fusion/score-normalizer.js";
export type { FusionStrategy } from "./fusion/fusion-strategy.js";
export { ReciprocalRankFusion } from "./fusion/reciprocal-rank-fusion.js";
export { WeightedFusion } from "./fusion/weighted-fusion.js";

export type { HybridRetrieverOptions } from "./hybrid/hybrid-retriever.js";
export { HybridRetriever } from "./hybrid/hybrid-retriever.js";

export type { QueryExpander } from "./query-expansion/query-expander.js";
export { IdentityExpander } from "./query-expansion/expanders/identity-expander.js";
export { SynonymExpander } from "./query-expansion/expanders/synonym-expander.js";
export { SubQueryExpander } from "./query-expansion/expanders/sub-query-expander.js";
export type { MultiQueryRetrieverOptions } from "./query-expansion/multi-query-retriever.js";
export { MultiQueryRetriever } from "./query-expansion/multi-query-retriever.js";
export { HyDERetriever } from "./query-expansion/hyde-retriever.js";
export { RewriteRetriever } from "./query-expansion/rewrite-retriever.js";
export type { DecompositionRetrieverOptions } from "./query-expansion/decomposition-retriever.js";
export { DecompositionRetriever } from "./query-expansion/decomposition-retriever.js";

export type { ChunkGrouping } from "./parent/chunk-grouping.js";
export { DocumentSiblingGrouping } from "./parent/chunk-grouping.js";
export type { ParentResolver } from "./parent/parent-resolver.js";
export { LongestSpanParentResolver } from "./parent/parent-resolver.js";
export type { ParentDocumentRetrieverOptions } from "./parent/parent-document-retriever.js";
export { ParentDocumentRetriever } from "./parent/parent-document-retriever.js";
