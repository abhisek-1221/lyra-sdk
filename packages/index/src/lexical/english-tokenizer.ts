import type { Tokenizer } from "./tokenizer.js";

/**
 * A small, deterministic English tokenizer.
 *
 * Behavior:
 *   - Lowercase.
 *   - Split on Unicode letters / digits / underscore boundaries.
 *   - Drop tokens of length <= 1 (drops punctuation and single
 *     letters like "I" — tunable via `minLength`).
 *   - Optionally drop stop-words.
 *   - No stemming in Phase 2; `stem` is a future extension point.
 *
 * The tokenizer is allocation-conscious: a single regex split is
 * the hot path. On a 10k-character document it completes in
 * single-digit milliseconds.
 */
export class EnglishTokenizer implements Tokenizer {
  private readonly minLength: number;
  private readonly stopWords: ReadonlySet<string>;

  // Captures runs of Unicode letters and digits. The `\p{L}` and
  // `\p{N}` Unicode property escapes require the `u` flag, which
  // is enabled below. Underscores and hyphens are treated as
  // separators.
  private static readonly SPLIT_RE = /[^\p{L}\p{N}]+/u;

  constructor(options: { minLength?: number; stopWords?: readonly string[] } = {}) {
    this.minLength = options.minLength ?? 2;
    // The custom list REPLACES the default stop-word set when
    // provided (including the empty array, which disables
    // filtering entirely). Callers who want both the defaults and
    // their own additions should pass [...DEFAULT_STOP_WORDS, ...].
    this.stopWords = new Set(options.stopWords ?? DEFAULT_STOP_WORDS);
  }

  public tokenize(text: string): readonly string[] {
    if (text.length === 0) return [];
    const lower = text.toLowerCase();
    const parts = lower.split(EnglishTokenizer.SPLIT_RE);
    const out: string[] = [];
    for (const p of parts) {
      if (p.length < this.minLength) continue;
      if (this.stopWords.has(p)) continue;
      out.push(p);
    }
    return out;
  }
}

/**
 * A compact English stop-word set. The list is small (40 words) and
 * deliberately omits short, content-bearing words like "us", "go",
 * "do" that some domains depend on. Callers may override via
 * `EnglishTokenizer`'s constructor.
 */
export const DEFAULT_STOP_WORDS: readonly string[] = [
  "a", "an", "and", "are", "as", "at", "be", "but", "by", "for",
  "from", "has", "have", "he", "in", "is", "it", "its", "of", "on",
  "or", "she", "that", "the", "they", "this", "to", "was", "were",
  "will", "with", "you", "your", "we", "our", "i", "me", "my", "so",
];
