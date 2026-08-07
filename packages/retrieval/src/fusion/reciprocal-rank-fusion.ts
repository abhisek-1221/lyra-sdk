import type { ScoredChunk } from "../contracts/retrieval-result.js";
import type { FusionStrategy } from "./fusion-strategy.js";

/**
 * Reciprocal Rank Fusion (Cormack, Clarke, Buettcher 2009).
 *
 * For each chunk `d`, the fused score is:
 *
 *   rrf(d) = Σ_{r ∈ retrievers} weight_r / (k + rank_r(d))
 *
 * where `rank_r(d)` is 1-based: the top hit has rank 1, the
 * second hit has rank 2, and so on. A chunk not in retriever
 * `r`'s top list contributes nothing from that retriever.
 *
 * Properties:
 *   - Rank-based: does not depend on the underlying retriever's
 *     score scale. BM25's unbounded scores and cosin's [-1, 1]
 *     scores can be fused without normalization.
 *   - Robust to outliers: the top hit's score contribution is
 *     `1 / (k + 1)`, and the n-th hit is `1 / (k + n)`. The
 *     difference between adjacent ranks shrinks as `n` grows.
 *   - No training data: works out of the box.
 *
 * The constant `k` dampens the contribution of high ranks. The
 * literature default is `k = 60`. Smaller values (e.g. `k = 1`)
 * make the top hit dominate; larger values make the ranking
 * more uniform.
 */
export class ReciprocalRankFusion implements FusionStrategy {
  public readonly name = "rrf";
  private readonly k: number;
  private readonly weights: readonly number[];

  constructor(options: { k?: number; weights?: readonly number[] } = {}) {
    this.k = options.k ?? 60;
    this.weights = options.weights ?? [];
  }

  public fuse(inputs: readonly (readonly ScoredChunk[])[]): readonly ScoredChunk[] {
    if (inputs.length === 0) return [];
    const w = this.weights.length > 0 ? this.weights : inputs.map(() => 1);

    // chunkId (string) -> { chunk, score }
    const acc = new Map<string, { chunk: ScoredChunk["chunk"]; score: number }>();
    for (let r = 0; r < inputs.length; r++) {
      const list = inputs[r]!;
      const weight = w[r] ?? 1;
      for (let i = 0; i < list.length; i++) {
        const entry = list[i]!;
        const key = entry.chunk.id as string;
        const rank = i + 1;
        const contribution = weight / (this.k + rank);
        const existing = acc.get(key);
        if (existing === undefined) {
          acc.set(key, { chunk: entry.chunk, score: contribution });
        } else {
          existing.score += contribution;
        }
      }
    }
    const out: ScoredChunk[] = [];
    for (const v of acc.values()) {
      out.push({ chunk: v.chunk, score: v.score });
    }
    out.sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      return (a.chunk.id as string) < (b.chunk.id as string)
        ? -1
        : (a.chunk.id as string) > (b.chunk.id as string)
          ? 1
          : 0;
    });
    return out;
  }
}
