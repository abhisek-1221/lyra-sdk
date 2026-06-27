import type { Conversation, Prompt } from "@lyra-sdk/prompt";

/**
 * The argument to `RetrievalPipeline.ask`. A single options
 * object (rather than positional arguments) is consistent with
 * the rest of Lyra (`ContextBuilderOptions`, `RerankerOptions`,
 * `PromptBuildArgs`).
 */
export interface AskRequest {
  /** The user's natural-language query. */
  readonly query: string;
  /** Number of candidates to retrieve. Default: 5. */
  readonly k?: number;
  /**
   * Optional pre-built prompt. When supplied, the
   * `PromptBuilder` is bypassed; the generator is called with
   * this prompt directly. Useful when the application wants
   * full control over the prompt (e.g. for tool use, multi-modal
   * inputs, or a custom system prompt).
   */
  readonly prompt?: Prompt;
  /**
   * Optional system-instruction override. Forwarded to the
   * `PromptBuilder`. Ignored when `prompt` is supplied.
   */
  readonly system?: string;
  /**
   * Optional conversation history. Forwarded to the
   * `PromptBuilder`. The builder copies the messages into a new
   * array and appends the new turn; the conversation is not
   * mutated. Ignored when `prompt` is supplied.
   */
  readonly conversation?: Conversation;
}
