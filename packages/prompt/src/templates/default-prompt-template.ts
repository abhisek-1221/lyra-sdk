import type { ContextChunk, TokenCounter } from "@lyra-sdk/context";
import { formatTimestamp } from "../formatter/index.js";
import type { CitationFormat } from "./citation-format.js";
import type { PromptTemplate } from "./prompt-template.js";

/** Appended to the user message when context was shortened or dropped. */
export const TRUNCATION_NOTE = "\n\nNote: some context was truncated to fit the budget.";

const defaultCite: CitationFormat = (index) => `[${index + 1}]`;

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
    cite,
  }: {
    query: string;
    rendered: readonly string[];
    truncated: boolean;
    chunks?: readonly ContextChunk[];
    cite?: CitationFormat;
  }): string => {
    const body = rendered.length > 0
      ? `Context:\n\n${rendered.join("\n\n")}\n\nQuestion:\n${query}`
      : `Question:\n${query}`;
    const withNote = truncated && rendered.length > 0 ? `${body}${TRUNCATION_NOTE}` : body;
    if (chunks === undefined || chunks.length === 0) return withNote;
    return `${withNote}\n\nSources:\n${renderSources(chunks, cite ?? defaultCite)}`;
  };
}

/**
 * Token count for one chunk rendered the way
 * {@link DefaultPromptTemplate.formatChunk} renders it.
 * `index` selects the citation marker, so `[10]` is wider than `[1]`.
 */
export function estimateRenderedChunkTokens(
  chunk: ContextChunk,
  counter: TokenCounter,
  index = 0,
  cite: CitationFormat = defaultCite,
): number {
  const header = buildHeader(chunk.speaker, chunk.timestamp);
  const marker = cite(index);
  const rendered = header.length > 0 ? `${marker} ${header}\n${chunk.text}` : `${marker} ${chunk.text}`;
  return counter.count(rendered);
}

/** Token count of the `Sources:` footer, including the blank line before it. */
export function estimateSourcesTokens(
  chunks: readonly ContextChunk[],
  counter: TokenCounter,
  cite: CitationFormat = defaultCite,
): number {
  if (chunks.length === 0) return 0;
  return counter.count(`\n\nSources:\n${renderSources(chunks, cite)}`);
}

export function renderSources(chunks: readonly ContextChunk[], cite: CitationFormat = defaultCite): string {
  return chunks.map((chunk, index) => formatSourceLine(chunk, index, cite)).join("\n");
}

export interface DefaultPromptTemplateOptions {
  /** Override the default system instructions. */
  readonly system?: string;
}

function formatSourceLine(chunk: ContextChunk, index: number, cite: CitationFormat): string {
  const marker = cite(index);
  const sources = [chunk.citation, ...(chunk.mergedCitations ?? [])];
  const labels: string[] = [];
  const urls: string[] = [];
  for (const source of sources) {
    if (source.label !== undefined && source.label.length > 0 && !labels.includes(source.label)) labels.push(source.label);
    if (source.url !== undefined && source.url.length > 0 && !urls.includes(source.url)) urls.push(source.url);
  }
  const name = labels.length > 0 ? labels.join(", ") : (sources[0]?.key ?? "");
  const timestamp = chunk.timestamp !== undefined ? ` @ ${formatTimestamp(chunk.timestamp)}` : "";
  const url = urls.length > 0 ? ` — ${urls.join(", ")}` : "";
  return `${marker} ${name}${timestamp}${url}`;
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
