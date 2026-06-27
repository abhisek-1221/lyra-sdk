/**
 * Per-call options for `Generator.generate` and `Generator.stream`.
 *
 * Both the `timeoutMs` deadline and the user-supplied `signal` are
 * honored; whichever fires first aborts the request.
 */
export interface GenerationOptions {
  /** Maximum time in ms before the request is aborted. */
  readonly timeoutMs?: number;
  /** Caller-supplied cancellation signal. Combined with `timeoutMs`. */
  readonly signal?: AbortSignal;
  /** Optional model override (provider-specific). */
  readonly model?: string;
  /** Optional temperature (default 0). */
  readonly temperature?: number;
  /** Optional max output tokens. */
  readonly maxOutputTokens?: number;
  /** Optional stop sequences. */
  readonly stopSequences?: readonly string[];
}
