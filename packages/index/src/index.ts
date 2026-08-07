/**
 * @lyra-sdk/index
 *
 * Vector index contracts, similarity metrics, lexical index
 * (BM25 / BM25+), and the Phase 1 in-memory `BruteForceIndex`.
 * sqlite-vec, pgvector, and Qdrant land in Phase 2.5 without
 * changing the public surface.
 *
 * Contents:
 *   - `VectorIndex`, `IndexedVector`, `SearchHit`, `IndexStats` — vector contracts
 *   - `SimilarityMetric`, `CosineSimilarity`, `DotProductSimilarity`, `EuclideanSimilarity` — vector strategies
 *   - `BruteForceIndex` — Phase 1 in-memory vector implementation
 *   - Lexical subpackage: `Tokenizer`, `EnglishTokenizer`, `InvertedIndex`, `InMemoryInvertedIndex`,
 *     `Posting`, `PostingList`, `BM25Index`, `BM25Scorer`, `BM25PlusScorer`, `LexicalScorer`
 *
 * @packageDocumentation
 */

export type { VectorIndex } from "./contracts/vector-index.js";
export type { IndexedVector, SearchHit, IndexStats } from "./contracts/indexed-vector.js";

export type { SimilarityMetric } from "./similarity/similarity-metric.js";
export { CosineSimilarity } from "./similarity/cosine-similarity.js";
export { DotProductSimilarity } from "./similarity/dot-product-similarity.js";
export { EuclideanSimilarity } from "./similarity/euclidean-similarity.js";

export { BruteForceIndex } from "./vector/brute-force-index.js";

// ─── Lexical (Phase 2) ─────────────────────────────────────────────────

export type { Tokenizer } from "./lexical/tokenizer.js";
export { EnglishTokenizer, DEFAULT_STOP_WORDS } from "./lexical/english-tokenizer.js";

export type { Posting, PostingList } from "./lexical/posting-list.js";

export type {
  InvertedIndex,
  LexicalDocumentStats,
  LexicalIndexStats,
} from "./lexical/inverted-index.js";
export { getPostingList } from "./lexical/inverted-index.js";
export { InMemoryInvertedIndex } from "./lexical/in-memory-inverted-index.js";

export type { LexicalScorer, BM25ScoreArgs } from "./lexical/bm25/lexical-scorer.js";
export { bm25Idf } from "./lexical/bm25/lexical-scorer.js";
export { BM25Scorer } from "./lexical/bm25/bm25-scorer.js";
export { BM25PlusScorer } from "./lexical/bm25/bm25-plus-scorer.js";
export type { BM25IndexOptions, BM25SearchHit } from "./lexical/bm25/bm25-index.js";
export { BM25Index } from "./lexical/bm25/bm25-index.js";
