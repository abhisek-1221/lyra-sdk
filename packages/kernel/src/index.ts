/**
 * @lyra-sdk/kernel
 *
 * Shared value types for the Lyra retrieval runtime.
 *
 * This package is the bottom of the dependency graph. Every other RAG
 * package (`@lyra-sdk/ingestion`, `@lyra-sdk/embedding`, `@lyra-sdk/storage`,
 * `@lyra-sdk/index`, `@lyra-sdk/retrieval`, `@lyra-sdk/pipeline`) depends on
 * it. Inlining these types would be a day of churn later, so they live in
 * their own package from day one.
 *
 * Contents:
 *   - {@link DocumentId}, {@link ChunkId}, {@link EmbeddingId} — branded ids
 *   - {@link createDocumentId}, {@link createChunkId}, {@link createEmbeddingId} — validators
 *   - {@link newChunkId}, {@link newEmbeddingId} — opaque id generators
 *   - {@link TextSpan} — half-open character offset pair
 *   - {@link KernelError}, {@link KernelErrorCode} — runtime error hierarchy
 *   - {@link kernelErrorCode} — narrowing helper
 *
 * @packageDocumentation
 */

export type { Brand } from "./brand.js";

export type {
  DocumentId,
  ChunkId,
  EmbeddingId,
} from "./ids.js";

export {
  createDocumentId,
  createChunkId,
  createEmbeddingId,
  newChunkId,
  newEmbeddingId,
} from "./ids.js";

export type { TextSpan } from "./types.js";

export type { KernelErrorCode } from "./errors.js";
export { KernelError, kernelErrorCode } from "./errors.js";
