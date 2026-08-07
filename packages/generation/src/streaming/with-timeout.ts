/**
 * Combine a caller-supplied `AbortSignal` with a `timeoutMs` deadline.
 *
 * The returned signal aborts when **either** the user's signal
 * aborts or the deadline elapses. If both are absent, the returned
 * signal is `undefined` (the underlying `fetch` then runs without
 * an explicit signal).
 *
 * Cancellation is composed with `AbortSignal.any` when both are
 * supplied, and with `AbortSignal.timeout` when only the deadline
 * is supplied.
 */
export function withTimeout(
  signal: AbortSignal | undefined,
  timeoutMs: number | undefined,
): AbortSignal | undefined {
  if (signal && timeoutMs !== undefined) {
    return AbortSignal.any([signal, AbortSignal.timeout(timeoutMs)]);
  }
  if (signal) return signal;
  if (timeoutMs !== undefined) return AbortSignal.timeout(timeoutMs);
  return undefined;
}
