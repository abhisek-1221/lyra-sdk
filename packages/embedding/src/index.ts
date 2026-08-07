/**
 * @lyra-sdk/embedding
 *
 * Embedding provider contracts, fetch-based adapters, and decorators
 * (cache, normalizer, batcher). Phase 1 ships OpenAI, Voyage, Jina,
 * and Ollama providers, plus `EmbeddingCache`, `L2Normalizer`, and
 * `TokenBatcher` decorators.
 *
 * All providers accept an `HttpTransport` via constructor injection
 * and never call `fetch` directly. The default transport wraps the
 * global `fetch`; tests pass a stub.
 *
 * @packageDocumentation
 */

export type { Embedder } from "./contracts/embedder.js";
export type { Embedding, EmbeddingTask } from "./contracts/embedding.js";
export type { EmbeddingRecord } from "./contracts/embedding-record.js";

export type { HttpRequest, HttpResponse, HttpTransport } from "./transport/http-transport.js";
export { FetchHttpTransport } from "./transport/http-transport.js";

export type { OpenAIEmbedderOptions } from "./providers/openai/openai-embedder.js";
export { OpenAIEmbedder } from "./providers/openai/openai-embedder.js";

export type { VoyageEmbedderOptions } from "./providers/voyage/voyage-embedder.js";
export { VoyageEmbedder } from "./providers/voyage/voyage-embedder.js";

export type { JinaEmbedderOptions } from "./providers/jina/jina-embedder.js";
export { JinaEmbedder } from "./providers/jina/jina-embedder.js";

export type { OllamaEmbedderOptions } from "./providers/ollama/ollama-embedder.js";
export { OllamaEmbedder } from "./providers/ollama/ollama-embedder.js";

export type { CacheStore } from "./cache/cache-store.js";
export { InMemoryCacheStore } from "./cache/cache-store.js";

export type { EmbeddingCacheKey } from "./cache/embedding-cache-key.js";
export {
  serializeEmbeddingCacheKey,
  makeEmbeddingCacheKey,
} from "./cache/embedding-cache-key.js";

export type { EmbeddingCacheOptions } from "./cache/embedding-cache.js";
export { EmbeddingCache } from "./cache/embedding-cache.js";

export { L2Normalizer } from "./normalization/l2-normalizer.js";

export type { TokenBatcherOptions } from "./batching/token-batcher.js";
export { TokenBatcher } from "./batching/token-batcher.js";
