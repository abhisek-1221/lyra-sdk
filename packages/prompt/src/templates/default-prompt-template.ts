import type { ContextChunk, TokenCounter } from "@lyra-sdk/context";
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

  public readonly formatUser = ({
    query,
    rendered,
    truncated,
    chunks,
  }: {
    query: string;
    rendered: readonly string[];
    truncated: boolean;
    chunks?: readonly ContextChunk[];
  }): string => {
    const body = rendered.length > 0
      ? `Context:\n\n${rendered.join("\n\n")}\n\nQuestion:\n${query}`
      : `Question:\n${query}`;
    const withNote = truncated ? `${body}\n\nNote: some context was truncated to fit the budget.` : body;
    if (chunks === undefined || chunks.length === 0) return withNote;
    return `${withNote}\n\nSources:\n${renderSources(chunks)}`;
  };
}

/**
 * Token count for one chunk rendered the way
 * {@link DefaultPromptTemplate.formatChunk} renders it, using a
 * `[1] ` marker. The real marker grows by one character at `[10]`.
 */
export function estimateRenderedChunkTokens(chunk: ContextChunk, counter: TokenCounter): number {
  const header = buildHeader(chunk.speaker, chunk.timestamp);
  const rendered = header.length > 0 ? `[1] ${header}\n${chunk.text}` : `[1] ${chunk.text}`;
  return counter.count(rendered);
}

/** Token count of the `Sources:` footer, including the blank line before it. */
export function estimateSourcesTokens(chunks: readonly ContextChunk[], counter: TokenCounter): number {
  if (chunks.length === 0) return 0;
  return counter.count(`\n\nSources:\n${renderSources(chunks)}`);
}

export function renderSources(chunks: readonly ContextChunk[]): string {
  return chunks.map((chunk) => formatSourceLine(chunk)).join("\n");
}

export interface DefaultPromptTemplateOptions {
  /** Override the default system instructions. */
  readonly system?: string;
}

function formatSourceLine(chunk: ContextChunk): string {
  const marker = chunk.citation.marker ?? 1;
  const cites = [chunk.citation, ...(chunk.mergedCitations ?? [])];
  const labels: string[] = [];
  const urls: string[] = [];
  for (const cite of cites) {
    if (cite.label !== undefined && cite.label.length > 0 && !labels.includes(cite.label)) labels.push(cite.label);
    if (cite.url !== undefined && cite.url.length > 0 && !urls.includes(cite.url)) urls.push(cite.url);
  }
  const name = labels.length > 0 ? labels.join(", ") : (cites[0]?.key ?? "");
  const timestamp = chunk.timestamp !== undefined ? ` @ ${formatTimestamp(chunk.timestamp)}` : "";
  const url = urls.length > 0 ? ` — ${urls.join(", ")}` : "";
  return `[${marker}] ${name}${timestamp}${url}`;
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
