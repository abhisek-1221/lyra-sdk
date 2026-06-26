/**
 * @lyra-sdk/storage
 *
 * Persistence layer for the Lyra retrieval runtime. Phase 1 ships
 * in-memory implementations only; SQLite and Postgres land in Phase 2
 * without changing the contracts.
 *
 * Contents:
 *   - `Chunk`, `SourceDocument`, `DocumentBlock` — value shapes
 *   - `ChunkRepository`, `DocumentRepository` — backend-agnostic contracts
 *   - `InMemoryChunkRepository`, `InMemoryDocumentRepository` — Phase 1 impls
 *
 * Depends on `@lyra-sdk/kernel` only. No upward imports.
 *
 * @packageDocumentation
 */

export type { Chunk } from "./chunks.js";
export type { DocumentBlock, SourceDocument } from "./documents.js";

export type { ChunkRepository } from "./contracts/chunk-repository.js";
export type { DocumentRepository } from "./contracts/document-repository.js";

export { InMemoryChunkRepository } from "./in-memory/in-memory-chunk-repository.js";
export { InMemoryDocumentRepository } from "./in-memory/in-memory-document-repository.js";
