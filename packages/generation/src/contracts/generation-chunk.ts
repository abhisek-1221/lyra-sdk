import type { GenerationResponse } from "./generation-response.js";

/**
 * A single text delta produced during a streaming generation.
 *
 * The model emits one `text` chunk per token (or per provider-defined
 * delta). The `delta` is the new text appended at the current
 * cursor; concatenating every `text.delta` in order reconstructs the
 * full response text.
 */
export interface GenerationTextChunk {
  readonly type: "text";
  readonly delta: string;
}

/**
 * A usage report emitted **once** near the end of a stream, just
 * before the `done` chunk. Carries the provider's input and output
 * token counts.
 *
 * Some providers report usage on the final delta event; others emit
 * a separate usage event. The base generator normalizes both shapes
 * into a single `usage` chunk.
 */
export interface GenerationUsageChunk {
  readonly type: "usage";
  readonly usage: {
    readonly inputTokens: number;
    readonly outputTokens: number;
  };
}

/**
 * The terminal chunk of a successful stream. Carries the assembled
 * `GenerationResponse`. Exactly one `done` chunk is emitted per
 * stream; never zero, never two.
 */
export interface GenerationDoneChunk {
  readonly type: "done";
  readonly response: GenerationResponse;
}

/**
 * The terminal chunk of a failed stream. Carries the error that
 * caused the stream to end. Exactly one `error` chunk is emitted at
 * most, and the stream ends immediately after.
 *
 * A generator never throws out of the iterator protocol; it yields
 * an `error` chunk and ends. Callers that aggregate streams
 * (`generate` via `collectStream`) convert the `error` chunk into
 * a `GenerationResponse` with `finishReason: "error"`.
 */
export interface GenerationErrorChunk {
  readonly type: "error";
  readonly error: Error;
}

/**
 * The discriminated union of every chunk a `Generator.stream` can
 * yield. Members are exported as named interfaces so consumers can
 * `switch` on `chunk.type` without TypeScript complaining about
 * overlapping properties.
 */
export type GenerationChunk =
  | GenerationTextChunk
  | GenerationUsageChunk
  | GenerationDoneChunk
  | GenerationErrorChunk;
