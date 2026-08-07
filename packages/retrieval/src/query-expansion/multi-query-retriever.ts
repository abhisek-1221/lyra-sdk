import type { ScoredChunk, RetrievalResult } from "../contracts/retrieval-result.js";
import type { Retriever } from "../contracts/retriever.js";
import type { QueryExpander } from "./query-expander.js";
import type { FusionStrategy } from "../fusion/fusion-strategy.js";
import { ReciprocalRankFusion } from "../fusion/reciprocal-rank-fusion.js";

/**
 * Options for {@link MultiQueryRetriever}.
 */
export interface MultiQueryRetrieverOptions {
  /** The underlying retriever. */
  readonly retriever: Retriever;
  /** The query expander. The original is always the first query. */
  readonly expander: QueryExpander;
  /**
   * How many results to ask the inner retriever for per
   * expanded query. Default: equal to the top-level `k`. Larger
   * values give the fusion more candidates to work with.
   */
  readonly innerK?: number;
  /**
   * The fusion strategy. Default: `ReciprocalRankFusion` with `k = 60`.
   * RRF is the literature default; switch to `WeightedFusion` if
   * you have calibrated per-query-source weights (rare for
   * expansion).
   */
  readonly fusion?: FusionStrategy;
}

/**
 * The multi-query retriever. Phase 2's first query-expansion
 * `Retriever`.
 *
 * Algorithm:
 *   1. `expander.expand(query)` returns `[original, ...alternatives]`.
 *   2. For each `q_i`, `retriever.retrieve(q_i, innerK)` is called.
 *      All calls run concurrently (`Promise.all`).
 *   3. The per-query results are fused via the `FusionStrategy`.
 *   4. The fused list is sliced to `k`.
 *   5. The original query is echoed in the result.
 *
 * The retriever is a **decorator**. It does not own the inner
 * retriever or the expander.
 */
export class MultiQueryRetriever implements Retriever {
  private readonly retriever: Retriever;
  private readonly expander: QueryExpander;
  private readonly innerK: number | undefined;
  private readonly fusion: FusionStrategy;

  constructor(options: MultiQueryRetrieverOptions) {
    this.retriever = options.retriever;
    this.expander = options.expander;
    this.innerK = options.innerK;
    this.fusion = options.fusion ?? new ReciprocalRankFusion();
  }

  public async retrieve(query: string, k: number): Promise<RetrievalResult> {
    const t0 = Date.now();
    const expanded = await this.expander.expand(query);
    const innerK = this.innerK ?? k;
    const lists = await Promise.all(
      expanded.map((q) => this.retriever.retrieve(q, innerK)),
    );
    const candidates: readonly (readonly ScoredChunk[])[] = lists.map((l) => l.results);
    const fused = this.fusion.fuse(candidates);
    return { query, results: fused.slice(0, k), durationMs: Date.now() - t0 };
  }
}
