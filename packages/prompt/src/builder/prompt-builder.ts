import type { Context } from "@lyra-sdk/context";
import type { Conversation } from "./conversation.js";
import type { Prompt } from "./prompt.js";
import type { CitationFormat } from "../templates/citation-format.js";

/**
 * The single args object for `PromptBuilder.build`. Single
 * object (rather than positional arguments) is consistent
 * with the rest of Lyra and is more extensible: adding a new
 * field does not break callers.
 */
export interface PromptBuildArgs {
  /** The user's natural-language query. */
  readonly query: string;
  /** The `Context` produced by the `ContextBuilder`. */
  readonly context: Context;
  /** Optional system-instruction override. Default: the template's `system`. */
  readonly system?: string;
  /** Optional citation marker. Default: `(i) => `[${i + 1}]``. */
  readonly citationFormat?: CitationFormat;
  /** Optional conversation history. The builder copies the
   *  messages into a new array and appends the new turn. */
  readonly conversation?: Conversation;
}

/**
 * The Prompt concern. A `PromptBuilder` is a **pure function**
 * that takes a `Context` plus a query and produces a `Prompt`.
 * It does not call the LLM; the generator does.
 *
 * `PromptBuilder` is an **assembler**, not a wording source.
 * The wording lives in a `PromptTemplate`; the builder wires
 * the template into a `Prompt`. This split lets callers
 * customize wording (`PromptTemplate`) and assembly
 * (`PromptBuilder`) independently.
 */
export interface PromptBuilder {
  build(args: PromptBuildArgs): Prompt;
}
