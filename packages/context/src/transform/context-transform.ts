import type { ContextChunk } from "../types/index.js";

/**
 * The base interface for every pure function that turns a
 * `readonly ContextChunk[]` into another `readonly ContextChunk[]`.
 *
 * Adjacent merging, metadata stripping, ordering, expansion —
 * none of these are "compression" in the user-facing sense; they
 * are all **context transformations**. The unified base makes
 * them interchangeable in the builder's chain.
 *
 * Implementations are pure: no I/O, no side effects. A
 * `ContextTransform` MAY be deterministic or non-deterministic
 * (e.g. `NearDeduplicator` may use a randomized hash), but
 * concurrent calls to the same `apply` with the same input MUST
 * produce equal outputs.
 */
export interface ContextTransform {
  /** A short identifier used in benchmark reports and logs. */
  readonly name: string;
  apply(chunks: readonly ContextChunk[]): readonly ContextChunk[];
}
