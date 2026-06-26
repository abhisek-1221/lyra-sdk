/**
 * A `CacheStore` is the minimal contract an `EmbeddingCache` needs to
 * persist `(key, embedding)` pairs across calls. The shape mirrors
 * `lyra-sdk`'s `CacheStore` (`packages/core/src/transcript/types.ts`)
 * so any value that satisfies the lyra-sdk type also satisfies this
 * one (TypeScript structural typing).
 *
 * Implementations live in the calling application; the embedding
 * package does not ship its own persistent cache. The default
 * {@link InMemoryCacheStore} is a `Map`-backed implementation for
 * tests and short-lived processes.
 */
export interface CacheStore {
  get(key: string): Promise<string | null>;
  set(key: string, value: string, ttl?: number): Promise<void>;
}

/**
 * An in-memory `CacheStore`. Backed by a `Map<string, { value: string; expiresAt: number | null }>`.
 * TTL is honored lazily on `get`: an expired entry is returned as `null`
 * and cleared.
 */
export class InMemoryCacheStore implements CacheStore {
  private readonly store = new Map<string, { value: string; expiresAt: number | null }>();

  public async get(key: string): Promise<string | null> {
    const entry = this.store.get(key);
    if (entry === undefined) return null;
    if (entry.expiresAt !== null && entry.expiresAt <= Date.now()) {
      this.store.delete(key);
      return null;
    }
    return entry.value;
  }

  public async set(key: string, value: string, ttl?: number): Promise<void> {
    const expiresAt = ttl !== undefined && ttl > 0 ? Date.now() + ttl * 1000 : null;
    this.store.set(key, { value, expiresAt });
  }
}
