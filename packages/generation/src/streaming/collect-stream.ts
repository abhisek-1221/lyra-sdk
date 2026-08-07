import type { GenerationChunk } from "../contracts/generation-chunk.js";
import type { GenerationResponse } from "../contracts/generation-response.js";

/**
 * Collect an `AsyncIterable<GenerationChunk>` into a single
 * `GenerationResponse`. The iterator must end with a `done` chunk;
 * otherwise the function throws.
 *
 * Strategy: aggregate `text` deltas and the optional `usage` chunk,
 * then return the `response` carried by the `done` chunk with the
 * accumulated text and usage merged in. The `response`'s
 * `provider`, `model`, `finishReason`, `citations`, and
 * `durationMs` come from the `done` chunk (set by the provider).
 *
 * On the first `error` chunk the function throws the chunk's
 * `error`.
 */
export async function collectStream(
  chunks: AsyncIterable<GenerationChunk>,
): Promise<GenerationResponse> {
  let text = "";
  let usage: { inputTokens: number; outputTokens: number } | undefined;
  let response: GenerationResponse | undefined;

  for await (const chunk of chunks) {
    switch (chunk.type) {
      case "text":
        text += chunk.delta;
        break;
      case "usage":
        usage = chunk.usage;
        break;
      case "done":
        response = chunk.response;
        break;
      case "error":
        throw chunk.error;
    }
  }

  if (!response) {
    throw new Error("collectStream: stream ended without a 'done' chunk");
  }

  return {
    ...response,
    text,
    ...(usage ? { usage } : {}),
    ...(response.usage ? { usage: response.usage } : {}),
  };
}
