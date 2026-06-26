import type { ChunkId } from "@lyra-sdk/kernel";

/**
 * A `Posting` is one entry in a posting list: a single term's
 * occurrence in a single chunk.
 *
 * - `chunkId`: the chunk the term appears in.
 * - `termFrequency`: how many times the term appears in the chunk.
 *   Phase 2 does not track positions; phrase queries land in
 *   Phase 3+.
 */
export interface Posting {
  readonly chunkId: ChunkId;
  readonly termFrequency: number;
}

/**
 * A `PostingList` is the set of postings for a single term, plus
 * the document frequency (`df`) cached on the list itself so BM25's
 * idf calculation is O(1) per term.
 *
 * Stored in the inverted index as `Map<term, PostingList>`.
 */
export interface PostingList {
  readonly term: string;
  readonly documentFrequency: number;
  readonly postings: readonly Posting[];
}
