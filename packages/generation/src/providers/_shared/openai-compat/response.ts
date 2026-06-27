import { mapOpenAiFinishReason, type OpenAiChatChunk } from "./request.js";

/**
 * The shared response mapper for OpenAI-compatible providers.
 *
 * The OpenAI streaming API does not return a single JSON object;
 * it returns a series of chunks. The `done` chunk is the
 * authoritative "stop" signal but does not carry the full
 * `text` — the consumer reassembles it from `text` deltas.
 *
 * For the non-streaming path (which Phase 4 does not exercise
 * for OpenAI), this mapper would take the same JSON shape and
 * return the same fields. The streaming path uses the chunks
 * directly and only consults the last `choices[0].finish_reason`
 * to populate `finishReason`.
 */
export function readOpenAiFinishReason(lastChunk: OpenAiChatChunk | undefined): "stop" | "length" | "tool_calls" | "content_filter" | "other" {
  return mapOpenAiFinishReason(lastChunk?.choices?.[0]?.finish_reason);
}
