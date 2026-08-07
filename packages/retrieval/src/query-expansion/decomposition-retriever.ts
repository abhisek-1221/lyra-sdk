import type { ScoredChunk, RetrievalResult } from "../contracts/retrieval-result.js";
import type { Retriever } from "../contracts/retriever.js";
import type { QueryExpander } from "./query-expander.js";
import type { FusionStrategy } from "../fusion/fusion-strategy.js";
import { ReciprocalRankFusion } from "../fusion/reciprocal-rank-fusion.js";

/**
 * Options for {@link DecompositionRetriever}.
 */
export interface DecompositionRetrieverOptions {
  /** The underlying retriever. */
  readonly retriever: Retriever;
  /**
   * The decomposition strategy. The expander takes a compound
   * query and returns its sub-queries; the retriever runs each
   * and fuses.
   */
  readonly expander: QueryExpander;
  /** The fusion strategy. Default: RRF. */
  readonly fusion?: FusionStrategy;
}

/**
 * The decomposition retriever. Splits a compound query into
 * sub-queries, runs each through the inner retriever, and
 * fuses. The user-facing difference from `MultiQueryRetriever`:
 * decomposition retriever is **task-driven** (the expander is
 * expected to produce a meaningful decomposition), whereas
 * multi-query is **recall-driven** (the expander is expected to
 * produce multiple phrasings of the same intent).
 *
 * In Phase 2, both retrievers share the same shape; the
 * distinction is in how the expander is intended to be used.
 * Phase 3+ may add task-specific expanders (e.g.
 * `StepBackExpander`, `LeastToMostExpander`).
 */
export class DecompositionRetriever implements Retriever {
  private readonly retriever: Retriever;
  private readonly expander: QueryExpander;
  private readonly fusion: FusionStrategy;

  constructor(options: DecompositionRetrieverOptions) {
    this.retriever = options.retriever;
    this.expander = options.expander;
    this.fusion = options.fusion ?? new ReciprocalRankFusion();
  }

  public async retrieve(query: string, k: number): Promise<RetrievalResult> {
    const t0 = Date.now();
    const sub = await this.expander.expand(query);
    const lists = await Promise.all(sub.map((q) => this.retriever.retrieve(q, k)));
    const candidates: readonly (readonly ScoredChunk[])[] = lists.map((l) => l.results);
    const fused = this.fusion.fuse(candidates);
    return { query, results: fused.slice(0, k), durationMs: Date.now() - t0 };
  }
}
