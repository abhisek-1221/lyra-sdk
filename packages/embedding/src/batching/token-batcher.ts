import type { Embedding } from "../contracts/embedding.js";
import type { Embedder } from "../contracts/embedder.js";

/**
 * Options for {@link TokenBatcher}.
 */
export interface TokenBatcherOptions {
  /**
   * Approximate max number of tokens per batch. The batcher uses a
   * cheap chars-per-token heuristic (4 chars ≈ 1 token) to estimate
   * token counts. The estimate is intentionally rough — exact
   * tokenization requires a model-specific tokenizer, which the
   * batcher does not have.
   *
   * Default: 8000.
   */
  readonly maxTokensPerBatch?: number;
  /**
   * Hard cap on items per batch, regardless of token estimate.
   * Default: 2048.
   */
  readonly maxItemsPerBatch?: number;
}

const CHARS_PER_TOKEN = 4;

/**
 * A token-aware batching decorator for any `Embedder`.
 *
 * The default `Embedder.embedMany` implementation is a single
 * network call. If the input list is too large (e.g. 50,000 chunks
 * at ~2,000 chars each ≈ 12,500,000 tokens), the call will fail with
 * a `KernelError("invalid_argument", …)` from the inner provider.
 *
 * `TokenBatcher` breaks the input into multiple smaller calls,
 * each within `(maxTokensPerBatch, maxItemsPerBatch)`. The results
 * are concatenated in input order.
 *
 * The batcher is stateless across calls: each `embedMany` invocation
 * partitions its own input.
 */
export class TokenBatcher implements Embedder {
  private readonly inner: Embedder;
  private readonly maxTokensPerBatch: number;
  private readonly maxItemsPerBatch: number;

  constructor(inner: Embedder, options: TokenBatcherOptions = {}) {
    this.inner = inner;
    this.maxTokensPerBatch = options.maxTokensPerBatch ?? 8000;
    this.maxItemsPerBatch = options.maxItemsPerBatch ?? 2048;
  }

  public async embed(input: string): Promise<Embedding> {
    const [emb] = await this.embedMany([input]);
    if (!emb) {
      throw new Error("TokenBatcher: inner embedder returned no embedding for a single input");
    }
    return emb;
  }

  public async embedMany(inputs: readonly string[]): Promise<readonly Embedding[]> {
    if (inputs.length === 0) return [];
    const batches = this.partition(inputs);
    const out: Embedding[] = [];
    for (const batch of batches) {
      const result = await this.inner.embedMany(batch);
      for (const r of result) out.push(r);
    }
    return out;
  }

  private partition(inputs: readonly string[]): readonly (readonly string[])[] {
    const result: string[][] = [];
    let current: string[] = [];
    let currentTokens = 0;

    for (const input of inputs) {
      const tokens = Math.ceil(input.length / CHARS_PER_TOKEN);
      const wouldExceedTokens = currentTokens + tokens > this.maxTokensPerBatch;
      const wouldExceedItems = current.length >= this.maxItemsPerBatch;
      if (current.length > 0 && (wouldExceedTokens || wouldExceedItems)) {
        result.push(current);
        current = [];
        currentTokens = 0;
      }
      current.push(input);
      currentTokens += tokens;
    }
    if (current.length > 0) result.push(current);
    return result;
  }
}
