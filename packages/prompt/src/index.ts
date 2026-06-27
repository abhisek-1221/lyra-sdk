/**
 * @lyra-sdk/prompt
 *
 * Provider-independent prompt construction. The bridge between
 * `@lyra-sdk/context` and `@lyra-sdk/generation`. Phase 4 of
 * the RAG plan.
 *
 * Contents:
 *   - `Prompt` value type — the wire payload sent to the model.
 *   - `PromptBuilder` (interface) + `DefaultPromptBuilder` —
 *     the assembler. Pure function over `(query, context, ...)`.
 *   - `PromptTemplate` (interface) + `DefaultPromptTemplate` —
 *     the wording source. Customizes the system instructions
 *     and the chunk/user-message formatters.
 *   - `Conversation` — a value type for prior turns. No
 *     storage, no summarization, no memory.
 *   - `formatTimestamp` — `HH:MM:SS` formatter for transcripts.
 *
 * The prompt package is a sibling of `@lyra-sdk/context` and
 * `@lyra-sdk/generation`; it depends on `context` for the
 * `Context` type but not on `generation`. The pipeline
 * composes all three.
 *
 * @packageDocumentation
 */

export type {
  Conversation,
  DefaultPromptBuilderOptions,
  JSONSchema,
  Prompt,
  PromptBuildArgs,
  PromptBuilder,
  PromptMessage,
} from "./builder/index.js";
export { DefaultPromptBuilder } from "./builder/index.js";

export type { CitationFormat, DefaultPromptTemplateOptions, PromptTemplate } from "./templates/index.js";
export { DEFAULT_SYSTEM_INSTRUCTIONS, DefaultPromptTemplate } from "./templates/index.js";

export { formatTimestamp } from "./formatter/index.js";
