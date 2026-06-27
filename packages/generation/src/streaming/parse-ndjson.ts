/**
 * Parse an NDJSON-shaped body string into a stream of records.
 *
 * Each non-empty line is a JSON object. Blank lines are skipped.
 * The function is the synchronous variant; the transport reads the
 * body as text. Providers that need true incremental streaming
 * can subclass and override `parseStreamBody`.
 */
export function* parseNdjsonBody<T = unknown>(bodyText: string): Generator<T> {
  for (const line of bodyText.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (trimmed.length === 0) continue;
    yield JSON.parse(trimmed) as T;
  }
}
