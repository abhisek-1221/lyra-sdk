import type { ContextChunk } from "@lyra-sdk/context";
import type { CitationFormat } from "./citation-format.js";

/**
 * The wording source for a `PromptBuilder`. The template owns
 * the system instructions and the formatting of each chunk and
 * the user message. The builder assembles — the template
 * provides wording.
 *
 * Two separate concerns. A caller that wants different wording
 * writes a new `PromptTemplate` and plugs it into the default
 * builder. A caller that wants to assemble messages differently
 * writes a new `PromptBuilder`. The two stay separable.
 */
export interface PromptTemplate {
  /** System instructions. Pure wording, no logic. */
  readonly system: string;

  /**
   * How to format a single chunk for inclusion in the prompt.
   * The `cite` argument is the caller's citation marker (e.g.
   * `(i) => `[${i + 1}]``); the template uses it to prefix
   * the chunk with a citation.
   */
  readonly formatChunk: (chunk: ContextChunk, index: number, cite: CitationFormat) => string;

  /**
   * How to format the user message that wraps the rendered
   * chunks and the user's query. The default `DefaultPromptTemplate`
   * emits a `Context:` block followed by `Question:`. The
   * `truncated` flag is true when the upstream `ContextBuilder`
   * dropped or truncated chunks to fit the budget.
   */
  readonly formatUser: (args: {
    readonly query: string;
    readonly rendered: readonly string[];
    readonly truncated: boolean;
  }) => string;
}
