import type { Embedding } from "./embedding.js";

/**
 * An `Embedder` turns text into vectors. The contract is intentionally
 * minimal — `embed` for one, `embedMany` for batches.
 *
 * Implementations MUST:
 *   - Return one `Embedding` per input, in the same order.
 *   - Reject empty input arrays in `embedMany` (use `embed` for one).
 *   - Reject inputs that exceed the provider's token limit with a
 *     `KernelError("invalid_argument", …)`.
 *
 * The contract does NOT specify retries, rate-limit handling, or
 * caching. Those are cross-cutting concerns; consumers wrap their
 * `Embedder` in `EmbeddingCache` and `L2Normalizer` decorators
 * (Phase 1 slice 8).
 */
export interface Embedder {
  embed(input: string): Promise<Embedding>;
  embedMany(inputs: readonly string[]): Promise<readonly Embedding[]>;
}
