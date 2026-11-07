/**
 * The strategy interfaces. The concrete classes live in their
 * respective sub-folders.
 *
 * Each strategy interface has its own method name (`order`,
 * `deduplicate`, `compress`, `expand`) so the call site reads
 * naturally. They do NOT extend `ContextTransform` because they
 * have different method names; they share a `name` property
 * with `ContextTransform` for observability.
 */
import type { DocumentId, TextSpan } from "@lyra-sdk/kernel";
import type { Chunk, ChunkRepository } from "@lyra-sdk/storage";
import type { ContextChunk } from "../types/index.js";

/**
 * Reorders chunks. Returns a permutation of the input.
 * Applied after budget selection so reading order cannot evict
 * a higher-scoring chunk.
 */
export interface ContextOrdering {
  readonly name: string;
  order(chunks: readonly ContextChunk[]): readonly ContextChunk[];
}

/**
 * Context passed to deduplicators that need to re-slice a
 * merged span from the source document.
 */
export interface DeduplicateContext {
  readonly resolveSpan?: (documentId: DocumentId, span: TextSpan) => Promise<string>;
}

/**
 * Drops or merges duplicate chunks.
 */
export interface Deduplicator {
  readonly name: string;
  deduplicate(
    chunks: readonly ContextChunk[],
    ctx?: DeduplicateContext,
  ): Promise<readonly ContextChunk[]>;
}

/**
 * Trims optional fields or shortens chunk text. The source
 * `span` stays the range in the document; `text` is the
 * display string.
 */
export interface Compressor {
  readonly name: string;
  compress(chunks: readonly ContextChunk[]): readonly ContextChunk[];
}

/**
 * Neighbors the expander may load, plus a callback that turns
 * a stored chunk into a `ContextChunk` the same way the builder
 * does for the retrieved set.
 */
export interface ExpandContext {
  readonly chunkRepository?: ChunkRepository;
  readonly toContextChunk?: (chunk: Chunk, score: number) => Promise<ContextChunk | undefined>;
}

/**
 * Pulls in additional chunks adjacent to the input (for example
 * a timestamp-aware transcript expander). Returns a superset of
 * the input. Applied before dedupe and budget selection.
 */
export interface Expander {
  readonly name: string;
  expand(chunks: readonly ContextChunk[], ctx?: ExpandContext): Promise<readonly ContextChunk[]>;
}
