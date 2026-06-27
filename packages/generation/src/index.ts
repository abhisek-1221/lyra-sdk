/**
 * @lyra-sdk/generation
 *
 * Provider-agnostic language model generation. Phase 4 of the RAG
 * plan.
 *
 * Contents:
 *   - `Generator`, `GenerationRequest`, `GenerationResponse<T>`,
 *     `GenerationOptions`, `GenerationChunk` — base contracts.
 *   - `BaseHttpGenerator` — abstract base that every provider
 *     extends. Implements `generate` over `stream` and `collectStream`.
 *   - `OpenAIGenerator`, `AnthropicGenerator`, `GeminiGenerator`,
 *     `OpenRouterGenerator`, `OllamaGenerator` — fetch-only
 *     providers, no SDKs. All accept an `HttpTransport` via
 *     constructor injection.
 *   - `parseJsonResponse` — JSON parser for structured outputs.
 *   - `parseSseBody`, `parseNdjsonBody`, `collectStream`,
 *     `withTimeout` — streaming helpers.
 *
 * The generation package is a sibling of `@lyra-sdk/prompt` and
 * `@lyra-sdk/context`; it depends on neither. The pipeline
 * composes all three.
 *
 * @packageDocumentation
 */

export type {
  GenerationChunk,
  GenerationDoneChunk,
  GenerationErrorChunk,
  GenerationTextChunk,
  GenerationUsageChunk,
} from "./contracts/generation-chunk.js";
export type { GenerationOptions } from "./contracts/generation-options.js";
export type { GenerationRequest } from "./contracts/generation-request.js";
export type { GenerationResponse } from "./contracts/generation-response.js";
export type { JSONSchema, Prompt, PromptMessage } from "./contracts/prompt.js";
export { KNOWN_PROVIDERS, type KnownProvider, assertProvider } from "./contracts/generator.js";
export type { Generator } from "./contracts/generator.js";

export { collectStream, parseNdjsonBody, parseSseBody, type SseEvent, withTimeout } from "./streaming/index.js";
export { parseJsonResponse } from "./structured/index.js";

export { BaseHttpGenerator, type BaseHttpGeneratorOptions, type TextOrUsageChunk } from "./providers/_shared/base-http-generator.js";

export { OpenAIGenerator } from "./providers/openai/index.js";
export type { OpenAIGeneratorOptions } from "./providers/openai/index.js";

export { AnthropicGenerator } from "./providers/anthropic/index.js";
export type { AnthropicGeneratorOptions } from "./providers/anthropic/index.js";

export { GeminiGenerator } from "./providers/gemini/index.js";
export type { GeminiGeneratorOptions } from "./providers/gemini/index.js";

export { OpenRouterGenerator } from "./providers/openrouter/index.js";
export type { OpenRouterGeneratorOptions } from "./providers/openrouter/index.js";

export { OllamaGenerator } from "./providers/ollama/index.js";
export type { OllamaGeneratorOptions } from "./providers/ollama/index.js";

