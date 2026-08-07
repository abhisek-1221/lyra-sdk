import type { OpenAiChatChunk } from "./request.js";
import type { TextOrUsageChunk } from "../../../providers/_shared/base-http-generator.js";

/**
 * The shared SSE-event mapper for OpenAI-compatible providers.
 *
 * Extracts a `text` chunk from `choices[0].delta.content` and
 * a `usage` chunk from the top-level `usage` field. Other events
 * (e.g. role-only deltas) return `null` and are skipped.
 *
 * The OpenAI wire format returns `usage` only on the **final**
 * chunk when `stream_options.include_usage` is set. Providers
 * that do not set that flag will never emit a `usage` chunk;
 * the assembled `GenerationResponse` then has no `usage` field.
 */
export function mapOpenAiSseEvent(event: { event: string; data: string }): TextOrUsageChunk | null {
  if (event.data === "[DONE]") return null;
  let parsed: OpenAiChatChunk;
  try {
    parsed = JSON.parse(event.data) as OpenAiChatChunk;
  } catch {
    return null;
  }

  if (parsed.usage) {
    const inputTokens = parsed.usage.prompt_tokens ?? 0;
    const outputTokens = parsed.usage.completion_tokens ?? 0;
    if (inputTokens > 0 || outputTokens > 0) {
      return { type: "usage", usage: { inputTokens, outputTokens } };
    }
  }

  const choice = parsed.choices?.[0];
  const delta = choice?.delta?.content;
  if (typeof delta === "string" && delta.length > 0) {
    return { type: "text", delta };
  }

  return null;
}
