/**
 * A single message in a `Prompt`. Roles are limited to
 * `system`, `user`, and `assistant` in Phase 4 — tool use
 * is Phase 5.
 *
 * The `content` is plain text. Provider-specific markup
 * (Anthropic's `content` blocks, Gemini's `parts[]`) is the
 * generator's job; the prompt stays metadata-free.
 */
export interface PromptMessage {
  readonly role: "system" | "user" | "assistant";
  readonly content: string;
}
