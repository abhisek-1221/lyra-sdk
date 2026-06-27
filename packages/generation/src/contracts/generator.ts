import type { GenerationChunk } from "./generation-chunk.js";
import type { GenerationOptions } from "./generation-options.js";
import type { GenerationRequest } from "./generation-request.js";
import type { GenerationResponse } from "./generation-response.js";

/**
 * The single Generation concern. Provider-agnostic. Generators
 * consume `Prompt`s, not `Context`s. `PromptBuilder` is the
 * separate concern that produces `Prompt`s; it lives in
 * `@lyra-sdk/prompt`.
 *
 * Two methods:
 *   - `generate` returns a single `GenerationResponse`. It is
 *     implemented as a thin wrapper over `stream` and
 *     `collectStream`.
 *   - `stream` is the authoritative implementation. Every provider
 *     implements only `stream`; `generate` is inherited from
 *     `BaseHttpGenerator`.
 *
 * Generators never throw out of the iterator protocol; they yield
 * an `error` chunk and end. `generate` converts a stream's
 * `error` chunk into a `GenerationResponse` with
 * `finishReason: "error"`.
 */
export interface Generator {
  /** Optional name for benchmark reports and logs. Default: class name. */
  readonly name?: string;

  /**
   * Generate a complete response. Returns the assembled text and
   * metadata.
   */
  generate<T = unknown>(
    request: GenerationRequest,
    options?: GenerationOptions,
  ): Promise<GenerationResponse<T>>;

  /**
   * Stream the response token-by-token. The stream ends with
   * exactly one `done` chunk (success) or one `error` chunk
   * (failure). A pre-aborted `signal` causes one `error` chunk
   * with `error.name === "AbortError"` and ends immediately.
   */
  stream(
    request: GenerationRequest,
    options?: GenerationOptions,
  ): AsyncIterable<GenerationChunk>;
}

/**
 * The set of `provider` strings every generator in this package
 * emits. Useful for benchmarks and for `switch` statements on
 * `response.provider`.
 */
export const KNOWN_PROVIDERS = [
  "openai",
  "anthropic",
  "gemini",
  "openrouter",
  "ollama",
] as const;

export type KnownProvider = (typeof KNOWN_PROVIDERS)[number];

/** Marker: a `provider` string is non-empty and stable per class. */
export function assertProvider(provider: string): void {
  if (typeof provider !== "string" || provider.length === 0) {
    throw new Error("Generator.provider must be a non-empty string");
  }
}
