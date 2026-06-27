/**
 * Parse an SSE-shaped body string into a stream of `{ event, data }`
 * records.
 *
 * SSE format:
 *   - Each line begins with `event:`, `data:`, `id:`, `retry:`, or
 *     is empty (a dispatch boundary).
 *   - An event spans multiple lines until an empty line.
 *   - The body ends with `[DONE]` in OpenAI's chat completions
 *     stream; we treat it as a single data record with
 *     `data: "[DONE]"`.
 *
 * This parser is the synchronous variant: the body is fully read
 * from the `HttpResponse.bodyText` (the `FetchHttpTransport` does
 * `await res.text()`). Providers that need true streaming
 * incrementally can subclass and override `parseStreamBody`.
 */
export interface SseEvent {
  readonly event: string;
  readonly data: string;
}

export function* parseSseBody(bodyText: string): Generator<SseEvent> {
  let event = "message";
  const dataLines: string[] = [];

  for (const rawLine of bodyText.split(/\r?\n/)) {
    if (rawLine.length === 0) {
      if (dataLines.length > 0 || event !== "message") {
        yield { event, data: dataLines.join("\n") };
        event = "message";
        dataLines.length = 0;
      }
      continue;
    }
    if (rawLine.startsWith(":")) continue; // comment
    const colonIdx = rawLine.indexOf(":");
    const field = colonIdx === -1 ? rawLine : rawLine.slice(0, colonIdx);
    const value = colonIdx === -1 ? "" : rawLine.slice(colonIdx + 1).replace(/^ /, "");
    switch (field) {
      case "event":
        event = value;
        break;
      case "data":
        dataLines.push(value);
        break;
      // ignore id, retry
    }
  }

  if (dataLines.length > 0 || event !== "message") {
    yield { event, data: dataLines.join("\n") };
  }
}
