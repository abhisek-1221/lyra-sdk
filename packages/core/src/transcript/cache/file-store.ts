import { createHash } from "node:crypto";
import { mkdir, readdir, readFile, rename, unlink, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { DEFAULT_CACHE_TTL } from "../constants.js";
import type { CacheStore } from "../types.js";

function sanitizeKey(key: string): string {
  const safe = key.replace(/[^a-zA-Z0-9_-]/g, "_");
  if (safe.length <= 200) return `${safe}.json`;
  const hash = createHash("sha256").update(key).digest("hex").slice(0, 16);
  return `${safe.slice(0, 184)}_${hash}.json`;
}

export class FsCache implements CacheStore {
  private readonly cacheDir: string;
  private readonly defaultTTL: number;
  private readonly ready: Promise<void>;

  constructor(cacheDir: string = "./cache", defaultTTL: number = DEFAULT_CACHE_TTL) {
    this.cacheDir = resolve(cacheDir);
    this.defaultTTL = defaultTTL;
    this.ready = mkdir(this.cacheDir, { recursive: true }).then(() => {});
  }

  async get(key: string): Promise<string | null> {
    await this.ready;
    const filePath = join(this.cacheDir, sanitizeKey(key));
    try {
      const raw = await readFile(filePath, "utf-8");
      const entry = JSON.parse(raw) as { value: string; expires: number };
      if (entry.expires > Date.now()) return entry.value;
      await unlink(filePath).catch(() => {});
    } catch {
      // file missing or corrupt — treat as cache miss
    }
    return null;
  }

  async set(key: string, value: string, ttl?: number): Promise<void> {
    await this.ready;
    const finalPath = join(this.cacheDir, sanitizeKey(key));
    const tmpPath = `${finalPath}.tmp`;
    const payload = JSON.stringify({ value, expires: Date.now() + (ttl ?? this.defaultTTL) });
    await writeFile(tmpPath, payload, "utf-8");
    await rename(tmpPath, finalPath);
  }

  async clear(): Promise<void> {
    await this.ready;
    const files = await readdir(this.cacheDir).catch(() => [] as string[]);
    await Promise.all(
      files
        .filter((f) => f.endsWith(".json"))
        .map((f) => unlink(join(this.cacheDir, f)).catch(() => {}))
    );
  }
}
