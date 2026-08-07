import type { ChunkId, DocumentId } from "@lyra-sdk/kernel";
import type { ContextCitation } from "../types/index.js";
import { makeCitationKey } from "../types/index.js";

/**
 * Build a `ContextCitation` for a `ContextChunk`. The default
 * key is `"<documentId>:<chunkId>"`. `label` and `url` are
 * optional and may be supplied by the application from the
 * `SourceDocument.metadata` (e.g. `metadata.title` -> `label`).
 */
export function makeCitation(input: {
  readonly documentId: DocumentId;
  readonly chunkId: ChunkId;
  readonly label?: string;
  readonly url?: string;
}): ContextCitation {
  let out: ContextCitation = { key: makeCitationKey(input.documentId, input.chunkId) };
  if (input.label !== undefined) {
    out = { ...out, label: input.label };
  }
  if (input.url !== undefined) {
    out = { ...out, url: input.url };
  }
  return out;
}

/**
 * Dedupe `ContextCitation[]` by `key`, preserving first-seen
 * order. Used by `ContextBuilder` to assemble the `Context.citations`
 * list from the surviving `ContextChunk[]`.
 */
export function dedupeCitations(citations: readonly ContextCitation[]): readonly ContextCitation[] {
  const seen = new Set<string>();
  const out: ContextCitation[] = [];
  for (const c of citations) {
    if (seen.has(c.key)) continue;
    seen.add(c.key);
    out.push(c);
  }
  return out;
}
