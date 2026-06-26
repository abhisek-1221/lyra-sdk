import type { ChunkId, DocumentId } from "@lyra-sdk/kernel";
import type { TextSpan } from "@lyra-sdk/kernel";

/**
 * The rendered citation for a single `ContextChunk`. Carried
 * alongside the chunk so the application can render `[1]`, `[2]`,
 * etc. inline and emit a footer from `Context.citations`.
 *
 * `key` is a stable identifier — typically `"<documentId>:<chunkId>"`
 * — that survives reranking and context construction. The
 * application uses it to dedupe across multiple chunks that
 * reference the same source.
 */
export interface ContextCitation {
  /** Stable citation key, e.g. "doc-3:chunk-7". */
  readonly key: string;
  /** Free-form label the application may use (e.g. "Smith 2024, p. 12"). */
  readonly label?: string;
  /** Optional URL when the source is web-indexed. */
  readonly url?: string;
}

/**
 * Build a citation key from a `documentId` and `chunkId`. The
 * application is free to use a different shape; this helper
 * exists for the common case.
 */
export function makeCitationKey(documentId: DocumentId, chunkId: ChunkId): string {
  return `${String(documentId)}:${String(chunkId)}`;
}

/**
 * A `ContextChunk` is a `ScoredChunk` resolved into text with
 * citation information attached. The text comes from a
 * `ChunkContentResolver`; the citation is built from the chunk
 * id and document id.
 *
 * `ContextChunk` is deeply `readonly`. The builder never mutates
 * after construction; if the application needs a different
 * shape, it constructs a new `Context` via a new builder call.
 */
export interface ContextChunk {
  readonly chunkId: ChunkId;
  readonly documentId: DocumentId;
  readonly text: string;
  readonly score: number;
  readonly span: TextSpan;
  /** When the source document is a transcript. */
  readonly timestamp?: number;
  /** When the source document is a transcript. */
  readonly speaker?: string;
  /**
   * Optional embedding for the resolved text. Populated by
   * the application when `NearDeduplicator` is in the chain.
   * Mirrors `ScoredChunk.embedding`: the resolver does not
   * embed; the caller threads the vector through.
   */
  readonly embedding?: Float32Array;
  readonly citation: ContextCitation;
  readonly metadata?: Readonly<Record<string, string | number | boolean>>;
}
