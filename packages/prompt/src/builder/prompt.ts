import type { JSONSchema } from "./json-schema.js";
import type { PromptMessage } from "./prompt-message.js";

/**
 * The `Prompt` value type. **The wire payload sent to the
 * model** — system instructions, ordered messages, an optional
 * schema for structured outputs, and a token estimate. It is
 * **not** a metadata container.
 *
 * `Prompt` does **not** carry citations. Citations are runtime
 * metadata that live on `Context` and on `GenerationResponse`;
 * the pipeline is the single seam that lifts citations
 * between them. `Prompt` and `GenerationRequest` are never
 * carriers of citations.
 *
 * This is the canonical declaration. The generator package
 * re-declares an identical shape (in
 * `@lyra-sdk/generation/src/contracts/prompt.ts`) to keep the
 * dependency graph acyclic; a structural-equality test enforces
 * that the two declarations stay assignment-compatible.
 */
export interface Prompt {
  /** System instructions. May be empty. */
  readonly system: string;
  /** Ordered messages. The last user message carries the user
   *  query and the rendered context. */
  readonly messages: readonly PromptMessage[];
  /** Optional JSON schema for structured outputs. */
  readonly schema?: JSONSchema;
  /** Approximate token estimate from the `TokenCounter`. */
  readonly estimatedInputTokens: number;
}
