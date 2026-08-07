import { formatTimestamp } from "../formatter/index.js";
import type { PromptTemplate } from "./prompt-template.js";

/**
 * The default system instructions shipped by Lyra. The
 * instructions tell the model to use **only** the context
 * provided, to be explicit when the answer is missing, and to
 * cite sources using `[n]` markers.
 */
export const DEFAULT_SYSTEM_INSTRUCTIONS = `\
You are a precise assistant. Use ONLY the context provided below to answer the user's question.
If the context does not contain the answer, say so explicitly.
Cite sources using the [n] markers that follow each claim; the citations are listed at the end.`;

/**
 * The default `PromptTemplate`. Emits citation markers
 * (`[1]`, `[2]`, …) prefixed on each chunk, an optional header
 * (speaker @ timestamp for transcripts), and a `Context:` +
 * `Question:` block. The user message notes truncation when
 * the upstream `ContextBuilder` had to drop or truncate chunks.
 */
export class DefaultPromptTemplate implements PromptTemplate {
  public readonly system: string;

  constructor(options: DefaultPromptTemplateOptions = {}) {
    this.system = options.system ?? DEFAULT_SYSTEM_INSTRUCTIONS;
  }

  public readonly formatChunk = (chunk: { text: string; speaker?: string; timestamp?: number }, _index: number, cite: (i: number) => string): string => {
    const header = buildHeader(chunk.speaker, chunk.timestamp);
    const citeMarker = cite(_index);
    return header.length > 0 ? `${citeMarker} ${header}\n${chunk.text}` : `${citeMarker} ${chunk.text}`;
  };

  public readonly formatUser = ({ query, rendered, truncated }: { query: string; rendered: readonly string[]; truncated: boolean }): string => {
    const body = rendered.length > 0
      ? `Context:\n\n${rendered.join("\n\n")}\n\nQuestion:\n${query}`
      : `Question:\n${query}`;
    return truncated ? `${body}\n\nNote: some context was truncated to fit the budget.` : body;
  };
}

export interface DefaultPromptTemplateOptions {
  /** Override the default system instructions. */
  readonly system?: string;
}

function buildHeader(speaker: string | undefined, timestamp: number | undefined): string {
  if (speaker && timestamp !== undefined) {
    return `${speaker} @ ${formatTimestamp(timestamp)}`;
  }
  if (speaker) {
    return speaker;
  }
  if (timestamp !== undefined) {
    return `@ ${formatTimestamp(timestamp)}`;
  }
  return "";
}
