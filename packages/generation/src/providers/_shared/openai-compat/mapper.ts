import { parseSseBody } from "../../../streaming/parse-sse.js";
import type { TextOrUsageChunk } from "../base-http-generator.js";
import { buildOpenAiRequestBody, type OpenAiChatRequestBody, type OpenAiChatChunk } from "./request.js";
import { mapOpenAiSseEvent } from "./sse-event.js";
import { readOpenAiFinishReason } from "./response.js";

/**
 * The OpenAI-compatible mapper. Bundles the request body
 * builder, the SSE event mapper, a `parseStreamBody` helper for
 * the `BaseHttpGenerator` base class, and a `readFinishReason`
 * helper for the final `done` chunk.
 *
 * `OpenAIGenerator` and `OpenRouterGenerator` both compose
 * `BaseHttpGenerator` with an instance of this mapper; they
 * differ only in their `provider` string, `baseUrl`, and
 * request-time headers.
 */
export class OpenAICompatibleMapper {
  public readonly provider: string;
  private lastChunk: OpenAiChatChunk | undefined;

  constructor(provider: string) {
    this.provider = provider;
  }

  /** Build the request body. Public so providers can override
   *  fields (e.g. `stream_options.include_usage`) before sending. */
  public buildBody(
    prompt: import("../../../contracts/prompt.js").Prompt,
    model: string,
    options: { temperature?: number; maxOutputTokens?: number; stopSequences?: readonly string[] } = {},
  ): OpenAiChatRequestBody {
    return buildOpenAiRequestBody(prompt, model, options);
  }

  /** Turn a transport response body into a stream of SSE events. */
  public parseStreamBody(response: { bodyText: string }): AsyncIterable<unknown> {
    return (async function* () {
      for (const event of parseSseBody(response.bodyText)) yield event;
    })();
  }

  /** Map a single SSE event to a chunk. */
  public mapEvent(event: unknown): TextOrUsageChunk | null {
    if (event === null || event === undefined || typeof event !== "object") return null;
    const e = event as { event: string; data: string };
    if (e.data === "[DONE]") return null;
    // Capture the last chunk for `finishReason`.
    try {
      this.lastChunk = JSON.parse(e.data) as OpenAiChatChunk;
    } catch {
      this.lastChunk = undefined;
    }
    return mapOpenAiSseEvent(e);
  }

  /** Read the `finish_reason` from the most recently seen chunk. */
  public readFinishReason(): "stop" | "length" | "tool_calls" | "content_filter" | "other" {
    return readOpenAiFinishReason(this.lastChunk);
  }

  /** Reset internal state. Call between streams. */
  public reset(): void {
    this.lastChunk = undefined;
  }
}
