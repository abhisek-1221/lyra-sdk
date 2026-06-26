import { randomUUID } from "node:crypto";
import { KernelError } from "./errors.js";
import type { Brand } from "./brand.js";

/**
 * A document identity. Backed by `string` at runtime, but the type system
 * refuses to accept a plain `string` where a `DocumentId` is required.
 *
 * Construction goes through {@link createDocumentId} so callers cannot forge
 * the brand by casting.
 */
export type DocumentId = Brand<string, "DocumentId">;

/**
 * A chunk identity. Chunks belong to a single document and are referenced
 * by the vector index and the retriever.
 */
export type ChunkId = Brand<string, "ChunkId">;

/**
 * An embedding identity. An `Embedding` is the materialized vector; the
 * `EmbeddingRecord` that links it back to a chunk is a separate value.
 */
export type EmbeddingId = Brand<string, "EmbeddingId">;

const ID_PATTERN = /^[A-Za-z0-9_-]+$/;

function assertValidId(label: string, value: string): void {
  if (value.length === 0) {
    throw new KernelError("invalid_id", `${label} must be a non-empty string`);
  }
  if (!ID_PATTERN.test(value)) {
    throw new KernelError(
      "invalid_id",
      `${label} may only contain [A-Za-z0-9_-], got: ${JSON.stringify(value)}`,
    );
  }
}

/**
 * Build a {@link DocumentId} from a trusted string. Used by parsers that
 * already control the value (e.g. `TranscriptParser` reading a video id).
 */
export function createDocumentId(value: string): DocumentId {
  assertValidId("DocumentId", value);
  return value as DocumentId;
}

/**
 * Build a {@link ChunkId} from a trusted string. Used by chunk strategies
 * that derive ids deterministically from `(documentId, span)`.
 */
export function createChunkId(value: string): ChunkId {
  assertValidId("ChunkId", value);
  return value as ChunkId;
}

/**
 * Build an {@link EmbeddingId} from a trusted string. Used by embedders and
 * embedding caches.
 */
export function createEmbeddingId(value: string): EmbeddingId {
  assertValidId("EmbeddingId", value);
  return value as EmbeddingId;
}

/**
 * Generate a fresh, opaque `ChunkId`. Useful for tests, for chunks whose
 * span-based id collides, or for runtime-generated synthetic chunks.
 *
 * Backed by `crypto.randomUUID()` (Node 22+ runtime requirement of the
 * monorepo, see root `package.json` engines).
 */
export function newChunkId(): ChunkId {
  return randomUUID() as ChunkId;
}

/**
 * Generate a fresh, opaque `EmbeddingId`. Mirrors {@link newChunkId}.
 */
export function newEmbeddingId(): EmbeddingId {
  return randomUUID() as EmbeddingId;
}
