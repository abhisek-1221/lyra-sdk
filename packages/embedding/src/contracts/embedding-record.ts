import type { ChunkId } from "@lyra-sdk/kernel";
import type { Embedding } from "./embedding.js";

/**
 * An `EmbeddingRecord` is the join row between a `Chunk` and an
 * `Embedding`. It is the value the retriever does not see — the index
 * stores only `{ id, vector }`, the chunk repository stores only the
 * chunk — but it is the value the pipeline produces after
 * `embedder.embedMany` and the value that gets joined back at
 * retrieval time.
 *
 * `EmbeddingRecord` lives in the embedding package (not in storage) so
 * the embedding layer is the single owner of the `Embedding` shape and
 * the mapping back to chunks.
 */
export interface EmbeddingRecord {
  readonly chunkId: ChunkId;
  readonly embedding: Embedding;
}
