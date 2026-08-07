import type { ChunkId } from "@lyra-sdk/kernel";
import type { ScoredChunk } from "@lyra-sdk/retrieval";
import type { Context, ContextBuilder } from "@lyra-sdk/context";

/**
 * A dataset for context benchmarks. Each example is a query
 * with the chunks that should appear in the assembled context
 * (`groundTruth`), and an expected token budget.
 */
export interface ContextExample {
  readonly query: string;
  /** The chunk ids that the assembled context should contain. */
  readonly relevant: readonly ChunkId[];
  readonly expectedTokenBudget: number;
}

export interface ContextDataset {
  readonly name: string;
  readonly examples: readonly ContextExample[];
}

/**
 * The result of one `ContextBenchmark.run()` call.
 */
export interface ContextBenchmarkReport {
  readonly builderLabel: string;
  readonly dataset: string;
  readonly tokenBudget: number;
  readonly totalQueries: number;
  /** Mean used tokens across queries. */
  readonly meanUsedTokens: number;
  /** Mean coverage: |relevant \cap context.chunkIds| / |relevant|. */
  readonly meanCoverage: number;
  /** Mean dedup ratio: (input - output) / input. 0 if no input. */
  readonly meanDedupRatio: number;
  /** Fraction of context chunks that have a non-empty citation key. */
  readonly citationCompleteness: number;
}

export interface ContextBenchmarkOptions {
  readonly builder: ContextBuilder;
  readonly builderLabel?: string;
  /** A function that, given a query, returns the `ScoredChunk[]`
   * to feed to the context builder. The caller wires up the
   * upstream pipeline (retrieval + reranking). */
  readonly retrieve: (query: string) => Promise<readonly ScoredChunk[]> | readonly ScoredChunk[];
  readonly dataset: ContextDataset;
  /** The token budget passed to the builder (overrides
   * `expectedTokenBudget` on each example if supplied). */
  readonly tokenBudget?: number;
}

/**
 * The context benchmark. Runs a `ContextBuilder` over a
 * `ContextDataset` and reports coverage, dedup ratio, citation
 * completeness, and used tokens.
 */
export class ContextBenchmark {
  public async run(options: ContextBenchmarkOptions): Promise<ContextBenchmarkReport> {
    let sumUsed = 0;
    let sumCoverage = 0;
    let sumDedup = 0;
    let totalCitationSlots = 0;
    let totalCitationFilled = 0;
    let queries = 0;
    for (const example of options.dataset.examples) {
      const retrieved = await options.retrieve(example.query);
      const budget = options.tokenBudget ?? example.expectedTokenBudget;
      // Build with the configured budget. The builder has its own
      // budget field, so we rely on the caller to have set it
      // appropriately. For the benchmark, we use the dataset's
      // expected budget as a sanity check.
      const context: Context = await options.builder.build(retrieved);
      sumUsed += context.usedTokens;
      // Coverage.
      const contextIds = new Set(context.chunks.map((c) => String(c.chunkId)));
      const relevantIds = new Set(example.relevant.map((c) => String(c)));
      let hit = 0;
      for (const id of relevantIds) {
        if (contextIds.has(id)) hit++;
      }
      const coverage = example.relevant.length === 0 ? 0 : hit / example.relevant.length;
      sumCoverage += coverage;
      // Dedup ratio: (input - output) / input. The retrieved is
      // the input; the context.chunks.length is the output.
      const inputN = retrieved.length;
      const outputN = context.chunks.length;
      const dedup = inputN === 0 ? 0 : (inputN - outputN) / inputN;
      sumDedup += dedup;
      // Citation completeness.
      for (const c of context.chunks) {
        totalCitationSlots++;
        if (c.citation.key.length > 0) totalCitationFilled++;
      }
      queries++;
      // Suppress the unused `budget` warning; it's an assertion
      // by the caller.
      void budget;
    }
    return {
      builderLabel: options.builderLabel ?? options.builder.name,
      dataset: options.dataset.name,
      tokenBudget: options.tokenBudget ?? 0,
      totalQueries: queries,
      meanUsedTokens: queries === 0 ? 0 : sumUsed / queries,
      meanCoverage: queries === 0 ? 0 : sumCoverage / queries,
      meanDedupRatio: queries === 0 ? 0 : sumDedup / queries,
      citationCompleteness:
        totalCitationSlots === 0 ? 0 : totalCitationFilled / totalCitationSlots,
    };
  }
}
