/**
 * The `Prompt` value type the generator consumes.
 *
 * This is a structural copy of the canonical declaration in
 * `@lyra-sdk/prompt`. The two declarations are kept in sync by
 * `tests/contracts/prompt-structural-equality.test.ts`; drift is a
 * test failure.
 *
 * Why two declarations: the prompt package and the generation
 * package are siblings, not parent/child. The pipeline composes
 * them; neither imports the other. The structural `Prompt` is the
 * only piece of the prompt contract the generator needs.
 */
export interface Prompt {
  /** System instructions. May be empty. */
  readonly system: string;
  /** Ordered messages. The last user message carries the user query
   *  and the rendered context. */
  readonly messages: readonly PromptMessage[];
  /** Optional JSON schema for structured outputs. */
  readonly schema?: JSONSchema;
  /** Approximate token estimate from `CharHeuristicTokenCounter`. */
  readonly estimatedInputTokens: number;
}

export interface PromptMessage {
  readonly role: "system" | "user" | "assistant";
  readonly content: string;
}

/**
 * A minimal JSON-schema type. We intentionally do not pull in `ajv`
 * or any schema library; structured outputs only pass the schema
 * through to the provider. Validation of the response is a separate
 * concern (see `parseJsonResponse`).
 */
export type JSONSchema = Readonly<Record<string, unknown>>;
