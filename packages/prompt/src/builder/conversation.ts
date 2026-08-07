import type { PromptMessage } from "./prompt-message.js";

/**
 * A `Conversation` is just an ordered list of prior messages.
 *
 * The prompt package treats `Conversation` as a **value type**,
 * not a service. There is no `ConversationManager`, no
 * `ConversationStore`, no `ConversationMemory`. The application
 * owns the array; the prompt builder appends the new turn; the
 * generator sends the result. An application that wants
 * persistence stores `Conversation` itself (e.g. in a database)
 * and threads it through successive `pipeline.ask` calls.
 *
 * Phase 5 may add `ConversationStore` for persistence and
 * `ConversationMemory` for summarization. Phase 4 ships the
 * value type and the builder hook; storage and summarization
 * are not in scope.
 */
export interface Conversation {
  /** Ordered messages from prior turns. The builder appends
   *  the new user turn at the end. The most recent
   *  `assistant` message is preserved if it exists. */
  readonly messages: readonly PromptMessage[];
}
