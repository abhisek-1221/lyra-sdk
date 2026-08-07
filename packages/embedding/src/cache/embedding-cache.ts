import { KernelError, newEmbeddingId } from "@lyra-sdk/kernel";
import type { Embedding, EmbeddingTask } from "../contracts/embedding.js";
import type { Embedder } from "../contracts/embedder.js";
import type { CacheStore } from "./cache-store.js";
import { makeEmbeddingCacheKey, serializeEmbeddingCacheKey } from "./embedding-cache-key.js";

/**
 * Options for {@link EmbeddingCache}.
 */
export interface EmbeddingCacheOptions {
  /**
   * The "provider" segment of the cache key. Identifies which backend
   * the wrapped embedder is (e.g. `"openai"`, `"voyage"`, `"ollama"`,
   * `"cohere"`).
   */
  readonly provider: string;
  /** The model segment. */
  readonly model: string;
  /** TTL in seconds. Optional; if omitted, entries never expire. */
  readonly ttlSeconds?: number;
}

/**
 * A content-addressed cache decorator for any `Embedder`. Wraps an
 * inner embedder and routes `embedMany` calls through the cache:
 *
 *   - Inputs that hit the cache are returned without calling the inner
 *     embedder. **The cached `Embedding` is returned with a fresh
 *     `id` (via `newEmbeddingId()`)** so ids remain unique per call,
 *     but the vector is the cached value.
 *   - Inputs that miss are batched into a single call to the inner
 *     embedder, then written back to the cache.
 *
 * The cache key is `sha256(provider + model + task + content)`. See
 * {@link EmbeddingCacheKey} for the rationale.
 */
export class EmbeddingCache implements Embedder {
  private readonly inner: Embedder;
  private readonly store: CacheStore;
  private readonly provider: string;
  private readonly model: string;
  private readonly ttlSeconds: number | undefined;

  constructor(inner: Embedder, store: CacheStore, options: EmbeddingCacheOptions) {
    if (!options.provider) {
      throw new KernelError("invalid_argument", "EmbeddingCache: provider is required");
    }
    if (!options.model) {
      throw new KernelError("invalid_argument", "EmbeddingCache: model is required");
    }
    this.inner = inner;
    this.store = store;
    this.provider = options.provider;
    this.model = options.model;
    this.ttlSeconds = options.ttlSeconds;
  }

  public async embed(input: string): Promise<Embedding> {
    const [embedding] = await this.embedManyWithTask([input], "document");
    if (!embedding) {
      throw new KernelError("upstream", "EmbeddingCache returned no embedding for a single input");
    }
    return embedding;
  }

  public async embedMany(inputs: readonly string[]): Promise<readonly Embedding[]> {
    return this.embedManyWithTask(inputs, "document");
  }

  /**
   * `embedMany` with an explicit task. The cache key includes the
   * task so `document` and `query` embeddings are never cross-mixed.
   */
  public async embedManyWithTask(
    inputs: readonly string[],
    task: EmbeddingTask,
  ): Promise<readonly Embedding[]> {
    if (inputs.length === 0) return [];

    const keys = inputs.map((s) =>
      serializeEmbeddingCacheKey(makeEmbeddingCacheKey(this.provider, this.model, task, s)),
    );

    // Look up all keys. We don't parallelize get() because the
    // `InMemoryCacheStore` is synchronous under the hood, and a
    // sequential loop is plenty fast for Phase 1.
    const cached: (Embedding | null)[] = new Array(inputs.length);
    const missingIndices: number[] = [];
    for (let i = 0; i < inputs.length; i++) {
      const raw = await this.store.get(keys[i]!);
      if (raw === null) {
        cached[i] = null;
        missingIndices.push(i);
      } else {
        cached[i] = decodeEmbedding(raw, inputs[i]!);
      }
    }

    if (missingIndices.length === 0) {
      return cached as Embedding[];
    }

    const missingInputs = missingIndices.map((i) => inputs[i]!);
    const fresh = await this.inner.embedMany(missingInputs);

    // Write fresh entries back to the cache, then splice them into the
    // result.
    for (let j = 0; j < missingIndices.length; j++) {
      const i = missingIndices[j]!;
      const emb = fresh[j]!;
      const key = keys[i]!;
      await this.store.set(key, encodeEmbedding(emb), this.ttlSeconds);
      cached[i] = emb;
    }
    return cached as Embedding[];
  }
}

const SEP = "\u0000";

function encodeEmbedding(emb: Embedding): string {
  // Round-trip the float values as a deterministic, lossy-but-stable
  // string. The 9-digit precision matches the lossless round-trip
  // range for `Float32Array` (Float32 has ~7 significant decimal
  // digits).
  const parts: string[] = [emb.model, String(emb.dimensions)];
  for (let i = 0; i < emb.vector.length; i++) {
    parts.push(emb.vector[i]!.toFixed(9));
  }
  return parts.join(SEP);
}

function decodeEmbedding(raw: string, fallbackContent: string): Embedding {
  const parts = raw.split(SEP);
  const model = parts[0]!;
  const dimensions = Number.parseInt(parts[1] ?? "0", 10);
  if (!Number.isFinite(dimensions) || dimensions < 0) {
    throw new KernelError("internal", `EmbeddingCache: corrupt cache entry for "${fallbackContent.slice(0, 40)}"`);
  }
  const expectedValues = parts.length - 2;
  if (expectedValues !== dimensions) {
    throw new KernelError("internal", `EmbeddingCache: dimension mismatch (${expectedValues} vs ${dimensions})`);
  }
  const vector = new Float32Array(dimensions);
  for (let i = 0; i < dimensions; i++) {
    vector[i] = Number.parseFloat(parts[i + 2]!);
  }
  return {
    id: newEmbeddingId(),
    vector,
    model,
    dimensions,
  };
}
