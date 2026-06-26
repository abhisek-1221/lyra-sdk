import type { LexicalScorer, BM25ScoreArgs } from "./lexical-scorer.js";

/**
 * The classic BM25 scorer (Robertson, Walker, Jones 1995).
 *
 *   tf_norm(t, d) = (tf * (k1 + 1)) / (tf + k1 * (1 - b + b * |d| / avgdl))
 *   contribution   = idf(t) * tf_norm(t, d)
 *
 * Returns `0` if the term is not in the chunk (no posting).
 *
 * Defaults: `k1 = 1.5`, `b = 0.75`. These are the literature values
 * and work well across most corpora; tunable via the constructor.
 */
export class BM25Scorer implements LexicalScorer {
  public readonly name = "bm25";
  private readonly k1: number;
  private readonly b: number;

  constructor(options: { k1?: number; b?: number } = {}) {
    this.k1 = options.k1 ?? 1.5;
    this.b = options.b ?? 0.75;
  }

  public score(args: BM25ScoreArgs): number {
    if (args.posting === undefined) return 0;
    if (args.averageDocLength <= 0) return 0;
    const tf = args.posting.termFrequency;
    const lenNorm = 1 - this.b + this.b * (args.docLength / args.averageDocLength);
    const tfNorm = (tf * (this.k1 + 1)) / (tf + this.k1 * lenNorm);
    return args.idf * tfNorm;
  }
}
