import type { ScoredChunk } from "../contracts/retrieval-result.js";
import type { ScoreNormalizer } from "./score-normalizer.js";
import { MinMaxScoreNormalizer } from "./score-normalizer.js";
import type { FusionStrategy } from "./fusion-strategy.js";

/**
 * Weighted linear-combination fusion.
 *
 * For each chunk `d`:
 *
 *   score(d) = Σ_{r ∈ retrievers} weight_r * normalize_r(score_r(d))
 *
 * Unlike RRF, weighted fusion is **score-based**, so a `ScoreNormalizer`
 * per retriever is required to make the underlying score scales
 * comparable. The default normalizer is `MinMaxScoreNormalizer`,
 * computed per call over the current candidate list.
 *
 * Use this when you have calibrated per-retriever weights (e.g.
 * "dense is twice as important as BM25 for this corpus"). RRF
 * is a safer default when you do not.
 */
export class WeightedFusion implements FusionStrategy {
  public readonly name = "weighted";
  private readonly weights: readonly number[];
  private readonly normalizers: readonly ScoreNormalizer[];

  constructor(options: {
    weights: readonly number[];
    normalizers?: readonly ScoreNormalizer[];
  }) {
    if (options.weights.length === 0) {
      throw new Error("WeightedFusion: at least one weight is required");
    }
    this.weights = options.weights;
    this.normalizers = options.normalizers ?? [];
  }

  public fuse(inputs: readonly (readonly ScoredChunk[])[]): readonly ScoredChunk[] {
    if (inputs.length === 0) return [];
    if (inputs.length !== this.weights.length) {
      throw new Error(
        `WeightedFusion: ${inputs.length} input lists but ${this.weights.length} weights`,
      );
    }

    // Per-list normalization: compute min/max, then normalize.
    const normalized: readonly (readonly ScoredChunk[])[] = inputs.map((list, idx) => {
      if (list.length === 0) return [];
      const normalizer = this.normalizers[idx] ?? new MinMaxScoreNormalizer();
      let min = Number.POSITIVE_INFINITY;
      let max = Number.NEGATIVE_INFINITY;
      for (const e of list) {
        if (e.score < min) min = e.score;
        if (e.score > max) max = e.score;
      }
      return list.map((e) => ({ chunk: e.chunk, score: normalizer.normalize(e.score, min, max) }));
    });

    const acc = new Map<string, { chunk: ScoredChunk["chunk"]; score: number }>();
    for (let r = 0; r < normalized.length; r++) {
      const list = normalized[r]!;
      const weight = this.weights[r]!;
      for (const entry of list) {
        const key = entry.chunk.id as string;
        const contribution = weight * entry.score;
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
