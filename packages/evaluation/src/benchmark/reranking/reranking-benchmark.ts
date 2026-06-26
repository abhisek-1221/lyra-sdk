import type { Retriever, ScoredChunk } from "@lyra-sdk/retrieval";
import type { Reranker } from "@lyra-sdk/reranking";
import type { RetrievalDataset } from "../../datasets/retrieval-dataset.js";

/**
 * The result of one `RerankingBenchmark.run()` call.
 */
export interface RerankingBenchmarkReport {
  readonly retrieverLabel: string;
  readonly rerankerLabel: string;
  readonly dataset: string;
  readonly k: number;
  readonly rerankK: number;
  readonly totalQueries: number;
  /** Per-query metrics. */
  readonly perQuery: readonly {
    readonly query: string;
    /** Recall of the post-rerank top-RerankK against the ground truth. */
    readonly recall: number;
    /** Mean reciprocal rank of the first ground-truth hit in the reranked list. */
    readonly mrr: number;
    /** Median latency in ms for the rerank call. */
    readonly latencyMs: number;
  }[];
  /** Aggregated metrics across queries. */
  readonly meanRecall: number;
  readonly meanMrr: number;
  readonly medianLatencyMs: number;
}

export interface RerankingBenchmarkOptions {
  readonly retriever: Retriever;
  readonly retrieverLabel?: string;
  readonly reranker: Reranker;
  readonly rerankerLabel?: string;
  readonly dataset: RetrievalDataset;
  /** Top-K candidates passed to the reranker. */
  readonly k: number;
  /** Top-RerankK returned by the reranker. */
  readonly rerankK: number;
}

/**
 * The reranking benchmark. Runs a `Retriever` over a
 * `RetrievalDataset`, then a `Reranker` over the top-K
 * candidates, and reports recall, MRR, and median latency.
 *
 * The benchmark assumes the retriever is ready to query. The
 * caller is responsible for any repositories the retriever
 * reads from.
 *
 * The reranker receives no `texts` (no cross-encoder input);
 * for cross-encoder benchmarks, supply a custom
 * `Reranker`/`CrossEncoderReranker` that the application has
 * pre-wired with mock-transport responses.
 */
export class RerankingBenchmark {
  public async run(options: RerankingBenchmarkOptions): Promise<RerankingBenchmarkReport> {
    const perQuery: RerankingBenchmarkReport["perQuery"][number][] = [];
    let sumRecall = 0;
    let sumMrr = 0;
    const latencies: number[] = [];
    for (const example of options.dataset.examples) {
      const t0 = Date.now();
      const retrieval = await options.retriever.retrieve(example.query, options.k);
      const rerank = await options.reranker.rerank(example.query, retrieval.results);
      const latency = Date.now() - t0;
      const top: readonly ScoredChunk[] = rerank.results.slice(0, options.rerankK);
      const recall = recallAtK(top, example.relevant);
      const mrr = meanReciprocalRank(top, example.relevant);
      perQuery.push({ query: example.query, recall, mrr, latencyMs: latency });
      sumRecall += recall;
      sumMrr += mrr;
      latencies.push(latency);
    }
    const total = options.dataset.examples.length;
    return {
      retrieverLabel: options.retrieverLabel ?? options.retriever.constructor.name,
      rerankerLabel: options.rerankerLabel ?? options.reranker.name,
      dataset: options.dataset.name,
      k: options.k,
      rerankK: options.rerankK,
      totalQueries: total,
      perQuery,
      meanRecall: total === 0 ? 0 : sumRecall / total,
      meanMrr: total === 0 ? 0 : sumMrr / total,
      medianLatencyMs: median(latencies),
    };
  }
}

function recallAtK(
  predictions: readonly ScoredChunk[],
  groundTruth: readonly import("@lyra-sdk/kernel").ChunkId[],
): number {
  if (groundTruth.length === 0) return 0;
  const truth = new Set(groundTruth.map((c) => String(c)));
  let hit = 0;
  for (const p of predictions) {
    if (truth.has(String(p.chunk.id))) hit++;
  }
  return hit / groundTruth.length;
}

function meanReciprocalRank(
  predictions: readonly ScoredChunk[],
  groundTruth: readonly import("@lyra-sdk/kernel").ChunkId[],
): number {
  if (groundTruth.length === 0) return 0;
  const truth = new Set(groundTruth.map((c) => String(c)));
  for (let i = 0; i < predictions.length; i++) {
    const p = predictions[i]!;
    if (truth.has(String(p.chunk.id))) return 1 / (i + 1);
  }
  return 0;
}

function median(xs: readonly number[]): number {
  if (xs.length === 0) return 0;
  const sorted = [...xs].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 0) {
    return ((sorted[mid - 1] ?? 0) + (sorted[mid] ?? 0)) / 2;
  }
  return sorted[mid] ?? 0;
}
