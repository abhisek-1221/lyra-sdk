import type { Posting } from "../posting-list.js";

/**
 * Arguments to a BM25 family scorer.
 *
 * - `term`: the query term.
 * - `idf`: the inverse-document-frequency contribution for this
 *   term. Computed by the caller (the index owns N and df).
 * - `posting`: the chunk's posting for this term. `undefined` if
 *   the term is not in the chunk.
 * - `docLength`: the chunk's unique-token count (the `|d|` in BM25).
 * - `averageDocLength`: the corpus's average unique-token count.
 */
export interface BM25ScoreArgs {
  readonly term: string;
  readonly idf: number;
  readonly posting: Posting | undefined;
  readonly docLength: number;
  readonly averageDocLength: number;
}

/**
 * The `LexicalScorer` is the Strategy interface for the BM25
 * family. It takes pre-computed idf and a posting (or its absence)
 * and returns the term's contribution to a chunk's total score.
 *
 * Multiple scorers (BM25, BM25+, BM25T, …) live behind this
 * interface; the `BM25Index` accepts one via constructor injection.
 */
export interface LexicalScorer {
  /** Stable name, used in logs and benchmark reports. */
  readonly name: string;
  score(args: BM25ScoreArgs): number;
}

/**
 * Compute the BM25 inverse-document-frequency for one term.
 *
 *   idf(t) = ln(1 + (N - df + 0.5) / (df + 0.5))
 *
 * The `+1` outside the log keeps idf positive even when `df > N/2`
 * (a term that appears in more than half the corpus). The
 * half-adjustments inside are the standard Robertson–Walker
 * formulation.
 */
export function bm25Idf(documentFrequency: number, totalDocs: number): number {
  if (totalDocs <= 0) return 0;
  return Math.log(1 + (totalDocs - documentFrequency + 0.5) / (documentFrequency + 0.5));
}
