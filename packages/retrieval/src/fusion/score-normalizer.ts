/**
 * A `ScoreNormalizer` maps a raw score from one retriever into a
 * comparable range. Required for `WeightedFusion` because BM25's
 * scores are unbounded while cosine similarity is in [-1, 1];
 * combining the two without normalization would let BM25 dominate.
 *
 * Normalizers operate on a per-call basis. The hybrid retriever
 * feeds the score list of one underlying retriever through one
 * `ScoreNormalizer` to produce a [0, 1]-ish range, then
 * `WeightedFusion` combines across retrievers.
 */
export interface ScoreNormalizer {
  /** Stable name, used in logs and benchmark reports. */
  readonly name: string;
  /**
   * Normalize a single score.
   *
   * @param score     the raw score from the underlying retriever
   * @param min       the minimum raw score in the current candidate list
   * @param max       the maximum raw score in the current candidate list
   */
  normalize(score: number, min: number, max: number): number;
}

/**
 * The default `ScoreNormalizer`: MinMax scaling.
 *
 *   normalized(s) = (s - min) / (max - min)    if max > min
 *                  1                              if max === min (degenerate)
 *                  0                              if score is below min (defensive)
 *
 * The output range is [0, 1] for any non-degenerate input. When
 * `max === min` (every score is identical — e.g. a single-candidate
 * list), every score normalizes to 1.
 *
 * MinMax is sensitive to outliers: one extremely high score
 * squeezes the rest of the distribution toward 0. The alternative
 * `ZScoreNormalizer` is more robust to outliers at the cost of
 * having no fixed [0, 1] range.
 */
export class MinMaxScoreNormalizer implements ScoreNormalizer {
  public readonly name = "minmax";

  public normalize(score: number, min: number, max: number): number {
    if (max > min) {
      const n = (score - min) / (max - min);
      return n < 0 ? 0 : n > 1 ? 1 : n;
    }
    if (max === min) {
      // All scores identical (or only one candidate). Rank the
      // candidate at 1.0 — there is no useful signal in a
      // degenerate distribution.
      return 1;
    }
    return 0;
  }
}

/**
 * Z-score normalization. Each score is mapped to
 *
 *   z(s) = (s - mean) / stddev
 *
 * with a final clip into a configurable range (default [-3, 3] →
 * [0, 1] after a sigmoid-like rescale).
 *
 * Z-score is robust to outliers but the output is unbounded
 * without clipping. Use this when MinMax's outlier sensitivity
 * is hurting your fusion.
 */
export class ZScoreScoreNormalizer implements ScoreNormalizer {
  public readonly name = "zscore";
  private readonly clip: number;

  constructor(options: { clip?: number } = {}) {
    this.clip = options.clip ?? 3;
  }

  public normalize(score: number, min: number, max: number): number {
    // Approximate mean and stddev from the min/max bounds. This is
    // not exact (the true mean is not necessarily (min+max)/2 for
    // an arbitrary distribution), but it is a stable approximation
    // that does not require a second pass over the candidates.
    const mean = (min + max) / 2;
    const range = max - min;
    if (range <= 0) return 0.5;
    const stddev = range / 2;
    if (stddev === 0) return 0.5;
    const z = (score - mean) / stddev;
    const clipped = Math.max(-this.clip, Math.min(this.clip, z));
    // Rescale [-clip, +clip] to [0, 1].
    return (clipped + this.clip) / (2 * this.clip);
  }
}
