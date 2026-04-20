import { DEFAULT_CACHE_TTL } from "../constants.js";
import type { CacheStore } from "../types.js";

interface CacheEntry {
  value: string;
  expires: number;
}

export class InMemoryCache implements CacheStore {
  private store = new Map<string, CacheEntry>();
  private readonly defaultTTL: number;
  private readonly maxEntries: number;

  constructor(defaultTTL: number = DEFAULT_CACHE_TTL, maxEntries: number = 500) {
    this.defaultTTL = defaultTTL;
    this.maxEntries = maxEntries;
  }

  async get(key: string): Promise<string | null> {
    const entry = this.store.get(key);
    if (!entry) return null;
    if (entry.expires <= Date.now()) {
      this.store.delete(key);
      return null;
    }
    return entry.value;
  }

  async set(key: string, value: string, ttl?: number): Promise<void> {
    if (this.store.size >= this.maxEntries && !this.store.has(key)) {
      const oldest = this.store.keys().next().value;
      if (oldest !== undefined) this.store.delete(oldest);
    }
    this.store.set(key, {
      value,
      expires: Date.now() + (ttl ?? this.defaultTTL),
    });
  }

  get size(): number {
    return this.store.size;
  }

  clear(): void {
    this.store.clear();
  }
}
