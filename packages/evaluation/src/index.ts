/**
 * @lyra-sdk/evaluation
 *
 * Retrieval evaluation. Ships the standard metrics
 * (Recall@K, Precision@K, Hit Rate, MRR, MAP, NDCG), the
 * dataset abstractions (`GoldenDataset`, `SyntheticDataset`),
 * and a `Benchmark` runner that ties them together.
 *
 * The package depends only on `@lyra-sdk/retrieval` (for the
 * `Retriever` contract and `ScoredChunk` shape) and
 * `@lyra-sdk/storage` (for `ChunkId`). It does not depend on
 * any specific index, embedder, or pipeline.
 *
 * @packageDocumentation
 */

export type { RetrievalMetric } from "./contracts/retrieval-metric.js";
export { RecallAtK } from "./metrics/recall-at-k.js";
export { PrecisionAtK } from "./metrics/precision-at-k.js";
export { HitRate } from "./metrics/hit-rate.js";
export { MeanReciprocalRank } from "./metrics/mrr.js";
export { MeanAveragePrecision } from "./metrics/map.js";
export { NDCG } from "./metrics/ndcg.js";

export type { RetrievalExample, RetrievalDataset } from "./datasets/retrieval-dataset.js";
export { GoldenDataset } from "./datasets/golden-dataset.js";
export {
  SyntheticDataset,
  constantExample,
  type SyntheticDatasetOptions,
} from "./datasets/synthetic-dataset.js";

export {
  Benchmark,
  type BenchmarkOptions,
  type BenchmarkReport,
} from "./benchmark/benchmark.js";
export {
  RerankingBenchmark,
  type RerankingBenchmarkOptions,
  type RerankingBenchmarkReport,
} from "./benchmark/reranking/reranking-benchmark.js";
export {
  ContextBenchmark,
  type ContextBenchmarkOptions,
  type ContextBenchmarkReport,
  type ContextDataset,
  type ContextExample,
} from "./benchmark/context/context-benchmark.js";
export {
  MockReverserReranker,
  MockJinaReranker,
  MockVoyageReranker,
  MockCohereReranker,
  MockBGEReranker,
} from "./benchmark/scenarios/mock-rerankers.js";
