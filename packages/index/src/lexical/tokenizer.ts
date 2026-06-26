/**
 * A `Tokenizer` turns a text string into a sequence of normalized
 * tokens suitable for inverted-index lookup.
 *
 * Implementations are responsible for:
 *   - Splitting the input on word boundaries.
 *   - Lowercasing (or other case-folding).
 *   - Removing punctuation.
 *   - Optionally dropping stop-words and applying stemming.
 *
 * The default implementation in Phase 2 is a small, deterministic
 * English tokenizer with configurable stop-word filtering and
 * Porter-stemming disabled by default. Phase 3+ may ship a
 * tokenizer registry so callers can plug in Snowball, ICU, or a
 * custom model.
 */
export interface Tokenizer {
  /**
   * Tokenize a text string.
   *
   * The returned array MUST NOT contain empty strings. Order
   * matters when positions are recorded (Phase 3+), but Phase 2
   * uses term frequency only.
   */
  tokenize(text: string): readonly string[];
}
