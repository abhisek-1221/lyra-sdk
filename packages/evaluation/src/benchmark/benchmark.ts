import type { Retriever } from "@lyra-sdk/retrieval";
import type { RetrievalDataset } from "../datasets/retrieval-dataset.js";
import type { RetrievalMetric } from "../contracts/retrieval-metric.js";

/**
 * The result of one `Benchmark.run()` call.
 *
 * - `retriever` is the `Retriever`'s class name (or a label
 *   supplied by the caller).
 * - `dataset` is the dataset's name.
 * - `metrics` maps metric name to aggregated value (mean over
 *   queries).
 * - `perQuery` is the per-query breakdown for debugging.
 */
export interface BenchmarkReport {
  readonly retriever: string;
  readonly dataset: string;
  readonly k: number;
  readonly totalQueries: number;
  readonly metrics: Readonly<Record<string, number>>;
  readonly perQuery: readonly {
    readonly query: string;
    readonly scores: Readonly<Record<string, number>>;
    readonly durationMs: number;
  }[];
}

export interface BenchmarkOptions {
  readonly retriever: Retriever;
  readonly retrieverLabel?: string;
  readonly dataset: RetrievalDataset;
  readonly metrics: readonly RetrievalMetric[];
  readonly k: number;
}

/**
 * The `Benchmark` runner. Runs the retriever over the dataset
 * and computes each requested metric.
 *
 * The runner is **stateless** across calls. It does not own the
 * retriever or the dataset. The caller is responsible for
 * pre-populating any repositories the retriever reads from
 * (the benchmark assumes the retriever is ready to query).
 *
 * The runner is sequential by default: each query is awaited
 * before the next. Concurrent execution is a Phase 3+
 * addition (the spec explicitly leaves it out of Phase 2).
 */
export class Benchmark {
  public async run(options: BenchmarkOptions): Promise<BenchmarkReport> {
    const perQuery: { query: string; scores: Record<string, number>; durationMs: number }[] = [];
    const sums: Record<string, number> = {};
    const counts: Record<string, number> = {};

    for (const example of options.dataset.examples) {
      const t0 = Date.now();
      const result = await options.retriever.retrieve(example.query, options.k);
      const durationMs = Date.now() - t0;
      const scores: Record<string, number> = {};
      for (const m of options.metrics) {
        const v = m.evaluate(result.results, example.relevant);
        scores[m.name] = v;
        sums[m.name] = (sums[m.name] ?? 0) + v;
        counts[m.name] = (counts[m.name] ?? 0) + 1;
      }
      perQuery.push({ query: example.query, scores, durationMs });
    }

    const aggregated: Record<string, number> = {};
    for (const name of Object.keys(sums)) {
      aggregated[name] = sums[name]! / Math.max(1, counts[name]!);
    }
    return {
      retriever: options.retrieverLabel ?? options.retriever.constructor.name,
      dataset: options.dataset.name,
      k: options.k,
      totalQueries: options.dataset.examples.length,
      metrics: aggregated,
      perQuery,
    };
  }
}
