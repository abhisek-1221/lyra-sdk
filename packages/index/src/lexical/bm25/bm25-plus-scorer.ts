import type { LexicalScorer, BM25ScoreArgs } from "./lexical-scorer.js";

/**
 * BM25+ (Lv, Zhai 2011) — adds a delta term to BM25 to bound the
 * contribution of a single query term and prevent the score from
 * being dominated by a single very-high-idf match.
 *
 *   contribution = idf(t) * (tf_norm(t, d) + delta)
 *
 *   where tf_norm uses BM25's standard formula, with a slight
 *   modification: the +1 in `(tf * (k1 + 1))` becomes `(tf + delta) * k1`
 *   under BM25+; we keep the standard tf_norm and add delta on top,
 *   which is the equivalent and is how most open-source BM25+
 *   implementations (e.g. `rank_bm25`) do it.
 *
 * Defaults: `k1 = 1.5`, `b = 0.75`, `delta = 1.0`.
 */
export class BM25PlusScorer implements LexicalScorer {
  public readonly name = "bm25+";
  private readonly k1: number;
  private readonly b: number;
  private readonly delta: number;

  constructor(options: { k1?: number; b?: number; delta?: number } = {}) {
    this.k1 = options.k1 ?? 1.5;
    this.b = options.b ?? 0.75;
    this.delta = options.delta ?? 1.0;
  }

  public score(args: BM25ScoreArgs): number {
    if (args.averageDocLength <= 0) return 0;
    let tfNorm: number;
    if (args.posting === undefined) {
      // No term in the chunk — BM25+ still adds delta * idf, which
      // bounds a single-term query's worst case.
      tfNorm = 0;
    } else {
      const tf = args.posting.termFrequency;
      const lenNorm = 1 - this.b + this.b * (args.docLength / args.averageDocLength);
      tfNorm = (tf * (this.k1 + 1)) / (tf + this.k1 * lenNorm);
    }
    return args.idf * (tfNorm + this.delta);
  }
}
