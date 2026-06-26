import type { ChunkId } from "@lyra-sdk/kernel";
import type {
  InvertedIndex,
  LexicalIndexStats,
} from "../inverted-index.js";
import { InMemoryInvertedIndex } from "../in-memory-inverted-index.js";
import { bm25Idf, type LexicalScorer, type BM25ScoreArgs } from "./lexical-scorer.js";
import { BM25Scorer } from "./bm25-scorer.js";
import type { Tokenizer } from "../tokenizer.js";
import { EnglishTokenizer } from "../english-tokenizer.js";
import { getPostingList } from "../inverted-index.js";

/**
 * A single BM25 search hit: the chunk's id and its BM25 score.
 *
 * Same shape as the vector index's `SearchHit`. The lexical
 * retriever resolves these ids to `Chunk` objects.
 */
export interface BM25SearchHit {
  readonly id: ChunkId;
  readonly score: number;
}

/**
 * Options for {@link BM25Index}.
 */
export interface BM25IndexOptions {
  /**
   * Tokenizer used for both ingest (`add(chunkId, text)`) and
   * search (`search(query, k)`). Default: `EnglishTokenizer` with
   * built-in stop-words.
   */
  readonly tokenizer?: Tokenizer;
  /**
   * Scorer. Default: `BM25Scorer` with `k1=1.5, b=0.75`. Swap for
   * `BM25PlusScorer` or your own `LexicalScorer` implementation.
   */
  readonly scorer?: LexicalScorer;
  /**
   * Pre-existing inverted index. Default: a fresh
   * `InMemoryInvertedIndex`. Useful for tests and for callers that
   * want to inject a custom backend (Phase 2.5 SQLite).
   */
  readonly index?: InvertedIndex;
}

/**
 * The lexical `BM25Index`. Owns an `InvertedIndex` and a
 * `LexicalScorer`. Two operations:
 *
 *   - `add(chunkId, text)`: tokenize, upsert postings.
 *   - `search(query, k)`: tokenize, score, return top-k.
 *
 * The index is **not a chunk store**. It does not know about
 * `Chunk` objects; it stores `(term → postings)`. The lexical
 * retriever resolves ids to chunks via the `ChunkRepository`,
 * matching the `BruteForceIndex` pattern from Phase 1.
 */
export class BM25Index {
  private readonly tokenizer: Tokenizer;
  private readonly scorer: LexicalScorer;
  private readonly index: InvertedIndex;

  constructor(options: BM25IndexOptions = {}) {
    this.tokenizer = options.tokenizer ?? new EnglishTokenizer();
    this.scorer = options.scorer ?? new BM25Scorer();
    this.index = options.index ?? new InMemoryInvertedIndex();
  }

  /** Tokenize and add a chunk's text. */
  public add(chunkId: ChunkId, text: string): void {
    this.index.add(chunkId, this.tokenizer.tokenize(text));
  }

  /** Idempotent remove. */
  public remove(chunkId: ChunkId): void {
    this.index.remove(chunkId);
  }

  /** Total number of chunks in the index. */
  public size(): number {
    return this.index.size();
  }

  /** Expose the underlying index for testing and advanced callers. */
  public rawIndex(): InvertedIndex {
    return this.index;
  }

  public stats(): LexicalIndexStats {
    return this.index.stats();
  }

  /**
   * Search the index for the top-k chunks matching the query.
   *
   * Algorithm:
   *   1. Tokenize the query.
   *   2. For each unique query term, fetch the posting list and
   *      compute idf (using the index's current N and df).
   *   3. For each posting in each list, compute the term's
   *      contribution to that chunk's score via the scorer.
   *   4. Aggregate per-chunk, then sort descending and slice to k.
   *
   * A chunk with **no** posting for a term is treated as having
   * `tf = 0` for that term; the scorer decides how to handle the
   * `posting === undefined` case (BM25 returns 0; BM25+ adds
   * `delta * idf`).
   */
  public search(query: string, k: number): readonly BM25SearchHit[] {
    if (k <= 0) return [];
    const queryTokens = this.tokenizer.tokenize(query);
    if (queryTokens.length === 0) return [];
    const totalDocs = this.index.size();
    if (totalDocs === 0) return [];
    const avgdl = this.index.averageChunkLength();
    if (avgdl <= 0) return [];

    // Deduplicate query terms; the same term contributes once per
    // chunk even if it appears multiple times in the query.
    const uniqueTerms = new Set<string>();
    for (const t of queryTokens) uniqueTerms.add(t);

    // Build a chunkId -> score map. We need the chunkLength for
    // each contributing chunk; pull it from the index.
    const lengthByChunk = new Map<ChunkId, number>();
    for (const s of this.index.chunkLengths()) {
      lengthByChunk.set(s.chunkId, s.length);
    }

    const scores = new Map<ChunkId, number>();

    for (const term of uniqueTerms) {
      const list = getPostingList(this.index, term);
      if (list.documentFrequency === 0) continue;
      const idf = bm25Idf(list.documentFrequency, totalDocs);

      // Apply the scorer to every chunk that contains the term
      // AND to every chunk that does NOT contain it but might
      // pick up a delta term (BM25+). For BM25, the no-posting
      // case returns 0, so we can skip the second pass.
      const scorerAddsForMissing = this.scorer.name !== "bm25";

      for (const posting of list.postings) {
        const docLength = lengthByChunk.get(posting.chunkId) ?? 0;
        const args: BM25ScoreArgs = {
          term,
          idf,
          posting,
          docLength,
          averageDocLength: avgdl,
        };
        const contrib = this.scorer.score(args);
        if (contrib !== 0) {
          scores.set(posting.chunkId, (scores.get(posting.chunkId) ?? 0) + contrib);
        }
      }

      if (scorerAddsForMissing) {
        // For scorers that score missing terms (BM25+), walk the
        // whole chunk set and accumulate `delta * idf` per chunk.
        // This is O(N) per missing-term context; in practice the
        // search runtime is dominated by `k` not by N. If the
        // corpus grows past 1M chunks, we can pre-compute a
        // `chunksWithNoPosting` list per term.
        for (const [chunkId, docLength] of lengthByChunk) {
          if (scores.has(chunkId) && this.hasPostingFor(list.postings, chunkId)) continue;
          const args: BM25ScoreArgs = {
            term,
            idf,
            posting: undefined,
            docLength,
            averageDocLength: avgdl,
          };
          const contrib = this.scorer.score(args);
          if (contrib !== 0) {
            scores.set(chunkId, (scores.get(chunkId) ?? 0) + contrib);
          }
        }
      }
    }

    if (scores.size === 0) return [];
    const out: BM25SearchHit[] = [];
    for (const [id, score] of scores) out.push({ id, score });
    out.sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      return (a.id as string) < (b.id as string) ? -1 : (a.id as string) > (b.id as string) ? 1 : 0;
    });
    return out.slice(0, k);
  }

  private hasPostingFor(postings: readonly { chunkId: ChunkId }[], chunkId: ChunkId): boolean {
    for (const p of postings) if (p.chunkId === chunkId) return true;
    return false;
  }
}
