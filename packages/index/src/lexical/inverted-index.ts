import type { ChunkId } from "@lyra-sdk/kernel";
import type { Posting, PostingList } from "./posting-list.js";

/**
 * Per-chunk statistics maintained by the inverted index. Length is
 * the number of unique tokens after tokenization (used as the
 * "document length" `|d|` in BM25).
 *
 * The same field is named `length` here for brevity; callers that
 * want a more descriptive name read it as `tokenCount` or
 * `uniqueTokenCount` depending on context.
 */
export interface LexicalDocumentStats {
  readonly chunkId: ChunkId;
  /** Number of unique tokens for this chunk. */
  readonly length: number;
}

/**
 * Backend-agnostic observability for any `InvertedIndex`
 * implementation. Mirrors the shape used by the vector
 * `IndexStats` so dashboards can be backend-agnostic.
 */
export interface LexicalIndexStats {
  readonly chunks: number;
  readonly terms: number;
  readonly averageChunkLength: number;
  readonly memoryUsage: number;
}

/**
 * The inverted-index contract. Phase 2 ships an in-memory
 * implementation; SQLite / RocksDB backends land in Phase 2.5.
 *
 * Invariants:
 *   - `add` is upsert: a chunk re-added with new text replaces its
 *     previous postings entirely.
 *   - `remove` is idempotent: removing a chunk that is not in the
 *     index is a no-op.
 *   - The `df` (document frequency) field on each `PostingList` is
 *     kept in sync with the postings.
 */
export interface InvertedIndex {
  add(chunkId: ChunkId, tokens: readonly string[]): void;
  remove(chunkId: ChunkId): void;
  postingsFor(term: string): readonly Posting[];
  /** Total number of chunks currently in the index. */
  size(): number;
  /** Stats for observability. */
  stats(): LexicalIndexStats;
  /** For `LexicalScorer` consumption: the per-chunk length table. */
  chunkLengths(): readonly LexicalDocumentStats[];
  /** For `LexicalScorer` consumption: the running average chunk length. */
  averageChunkLength(): number;
}

/**
 * A read-only view of the `PostingList` for a single term, used by
 * scorers that need both postings and `df` together.
 */
export function getPostingList(index: InvertedIndex, term: string): PostingList {
  const postings = index.postingsFor(term);
  return { term, documentFrequency: postings.length, postings };
}
