import type { ContextCitation } from "@lyra-sdk/context";

/**
 * The full response of a `Generator.generate` call (or the
 * `response` field of a `GenerationDoneChunk`).
 *
 * Generic over `T`, the type of the parsed `data` when a
 * `prompt.schema` is supplied. Default `T = unknown` preserves
 * the no-schema case.
 *
 *   const resp = await generator.generate<UserProfile>({ prompt });
 *   resp.data is `UserProfile` (no cast).
 */
export interface GenerationResponse<T = unknown> {
  /** Concatenated text of every chunk in the stream. */
  readonly text: string;
  /** Parsed JSON when `prompt.schema` was set; typed as `T`. */
  readonly data?: T;
  /** Provider's own usage report, when reported. */
  readonly usage?: {
    readonly inputTokens: number;
    readonly outputTokens: number;
  };
  /** Provider identifier (e.g. "openai"). Useful for benchmarks. */
  readonly provider: string;
  /** Provider model identifier (e.g. "gpt-4o-mini-2024-07-18"). */
  readonly model: string;
  /** Provider-reported finish reason. */
  readonly finishReason:
    | "stop"
    | "length"
    | "tool_calls"
    | "content_filter"
    | "error"
    | "other";
  /** Citations passed through unchanged from `Context.citations`. */
  readonly citations: readonly ContextCitation[];
  /** Latency in milliseconds from `stream`/`generate` start to last byte. */
  readonly durationMs: number;
  /** Per-stage timings for benchmarking. */
  readonly diagnostics: Readonly<Record<string, number>>;
}

/**
 * Re-exported so callers that only depend on `@lyra-sdk/generation`
 * can type their prompts without reaching into the contracts
 * subfolder.
 */
export type { JSONSchema, Prompt, PromptMessage } from "./prompt.js";
