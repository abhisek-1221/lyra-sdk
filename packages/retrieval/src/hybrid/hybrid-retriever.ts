import type { ScoredChunk, RetrievalResult } from "../contracts/retrieval-result.js";
import type { Retriever } from "../contracts/retriever.js";
import type { FusionStrategy } from "../fusion/fusion-strategy.js";

/**
 * Options for {@link HybridRetriever}.
 */
export interface HybridRetrieverOptions {
  /** Two or more underlying retrievers. */
  readonly retrievers: readonly Retriever[];
  /** The fusion strategy. */
  readonly fusion: FusionStrategy;
  /**
   * Per-retriever over-fetch factor. The hybrid retriever asks
   * each underlying retriever for `k * fanoutK` results, then
   * fuses and slices to `k`. This compensates for the fact that
   * the union of N top-k lists is up to N*k, and a meaningful
   * chunk may be at position k+1 in one list but rank 1 in
   * another. Default: `1` (no over-fetch).
   */
  readonly fanoutK?: number;
}

/**
 * The hybrid retriever. Phase 2's only `Retriever` that composes
 * other `Retriever`s.
 *
 * Algorithm:
 *   1. For each underlying retriever, call `retrieve(query, innerK)`.
 *   2. Collect all `ScoredChunk[]` lists.
 *   3. Apply `fusion.fuse(lists)` to produce a single ranked list.
 *   4. Slice to `k`.
 *   5. Return `RetrievalResult` with the original query and elapsed ms.
 *
 * The retriever is a **decorator**: it does not own any
 * underlying retriever. It composes them. Each underlying
 * retriever can itself be a hybrid (deeper composition), a
 * multi-query retriever, a parent retriever, etc. The composition
 * is a tree, not a flat list.
 */
export class HybridRetriever implements Retriever {
  private readonly retrievers: readonly Retriever[];
  private readonly fusion: FusionStrategy;
  private readonly fanoutK: number;

  constructor(options: HybridRetrieverOptions) {
    if (options.retrievers.length < 2) {
      throw new Error("HybridRetriever: at least 2 retrievers are required");
    }
    this.retrievers = options.retrievers;
    this.fusion = options.fusion;
    this.fanoutK = options.fanoutK ?? 1;
  }

  public async retrieve(query: string, k: number): Promise<RetrievalResult> {
    const t0 = Date.now();
    const innerK = k * this.fanoutK;
    const lists = await Promise.all(
      this.retrievers.map((r) => r.retrieve(query, innerK)),
    );
    const candidates: readonly (readonly ScoredChunk[])[] = lists.map((l) => l.results);
    const fused = this.fusion.fuse(candidates);
    return { query, results: fused.slice(0, k), durationMs: Date.now() - t0 };
  }
}
