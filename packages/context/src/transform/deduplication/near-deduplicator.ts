import type { ContextChunk } from "../../types/index.js";
import type { Deduplicator } from "../strategies.js";

/**
 * Drops near-duplicate chunks. Cosine similarity above the
 * configured threshold (default 0.95) means the two chunks are
 * effectively the same; the lower-scored one is dropped.
 *
 * The contract is text-based: this deduplicator requires the
 * caller to have supplied `embedding` on each chunk (e.g. via a
 * retriever that populated `ScoredChunk.embedding`, or via a
 * separate embedding pass over the resolved text). When
 * `embedding` is absent, the chunk is kept (the deduplicator
 * cannot judge similarity without a vector).
 *
 * O(n²) per call. Run on small lists. The default
 * `DefaultDeduplicator` chain runs `Exact -> Adjacent -> Near`,
 * so the near pass sees a smaller input.
 */
export class NearDeduplicator implements Deduplicator {
  public readonly name = "near";
  private readonly threshold: number;

  constructor(options: { threshold?: number } = {}) {
    const t = options.threshold ?? 0.95;
    if (t <= 0 || t > 1) {
      throw new Error(`NearDeduplicator: threshold must be in (0, 1], got ${t}`);
    }
    this.threshold = t;
  }

  public deduplicate(chunks: readonly ContextChunk[]): readonly ContextChunk[] {
    if (chunks.length === 0) return [];
    const out: ContextChunk[] = [];
    for (const c of chunks) {
      // Chunks without an embedding cannot be judged; keep them.
      const emb = c.embedding;
      if (emb === undefined) {
        out.push(c);
        continue;
      }
      let dominated = false;
      for (const existing of out) {
        if (existing.embedding === undefined) continue;
        if (cosineSim(emb, existing.embedding) >= this.threshold) {
          dominated = true;
          break;
        }
      }
      if (!dominated) out.push(c);
    }
    return out;
  }
}

function cosineSim(a: Float32Array, b: Float32Array): number {
  if (a.length !== b.length) return 0;
  let s = 0;
  for (let i = 0; i < a.length; i++) {
    s += (a[i] ?? 0) * (b[i] ?? 0);
  }
  return s;
}
