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
import type { ContextChunk } from "../types/index.js";

/**
 * Reorders chunks. Returns a permutation of the input.
 */
export interface ContextOrdering {
  readonly name: string;
  order(chunks: readonly ContextChunk[]): readonly ContextChunk[];
}

/**
 * Drops duplicate chunks. Returns a subset of the input.
 */
export interface Deduplicator {
  readonly name: string;
  deduplicate(chunks: readonly ContextChunk[]): readonly ContextChunk[];
}

/**
 * Trims chunk text to fit a budget. Returns the same set of
 * citations, possibly with shorter text.
 */
export interface Compressor {
  readonly name: string;
  compress(chunks: readonly ContextChunk[]): readonly ContextChunk[];
}

/**
 * Pulls in additional chunks adjacent to the input (e.g. a
 * timestamp-aware transcript expander). Returns a superset of
 * the input within a budget; applied first in the chain, before
 * the budget allocator.
 */
export interface Expander {
  readonly name: string;
  expand(chunks: readonly ContextChunk[]): readonly ContextChunk[];
}
