import type { ScoredChunk } from "../contracts/retrieval-result.js";

/**
 * A `FusionStrategy` merges multiple ranked candidate lists
 * (one per underlying retriever) into a single ranked list.
 *
 * Each input list is a `ScoredChunk[]` from one underlying
 * retriever. The output is also a `ScoredChunk[]`. The fusion
 * strategy owns the merge algorithm; it does not own any
 * retrievers.
 *
 * Implementations MUST:
 *   - Preserve the `chunk` reference for every output entry.
 *   - Return results in descending score order.
 *   - Deduplicate: if a chunk appears in multiple input lists,
 *     it appears exactly once in the output, with a fused score.
 *   - Be deterministic for the same inputs.
 */
export interface FusionStrategy {
  readonly name: string;
  fuse(inputs: readonly (readonly ScoredChunk[])[]): readonly ScoredChunk[];
}
