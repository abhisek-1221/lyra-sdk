/**
 * Counts the tokens in a string. The default is the
 * `CharHeuristicTokenCounter` (chars/4). Applications that
 * have a real tokenizer (e.g. `gpt-tokenizer`, `tiktoken`)
 * can inject a more accurate one.
 *
 * The contract is intentionally model-agnostic; the count is
 * used for budget checks, not for actual LLM token limits.
 * Phase 4 may add a tokenizer-backed counter.
 */
export interface TokenCounter {
  count(text: string): number;
}

/**
 * A char/4 heuristic counter. Fast and model-agnostic. Off by
 * ~25% from real tokenizers for English prose; accurate to a
 * few percent for code.
 */
export class CharHeuristicTokenCounter implements TokenCounter {
  public count(text: string): number {
    return Math.ceil(text.length / 4);
  }
}
