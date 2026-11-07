import type { ContextChunk } from "../../types/index.js";
import type { Deduplicator } from "../strategies.js";

/**
 * Drops near-duplicate chunks in the same document. Cosine
 * similarity at or above the threshold (default 0.95) means the
 * two chunks are effectively the same. The higher-scoring chunk
 * is kept. Equal scores keep the earlier input chunk.
 *
 * Chunks without an embedding are kept. Chunks from different
 * documents are never collapsed, so a second source survives.
 *
 * O(n²) per call. Run on small lists, before span merging, so
 * the vector still belongs to the original span.
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

  public async deduplicate(chunks: readonly ContextChunk[]): Promise<readonly ContextChunk[]> {
    if (chunks.length === 0) return [];
    const ranked = chunks
      .map((c, i) => ({ c, i }))
      .sort((a, b) => {
        if (b.c.score !== a.c.score) return b.c.score - a.c.score;
        return a.i - b.i;
      });
    const out: ContextChunk[] = [];
    for (const { c } of ranked) {
      const emb = c.embedding;
      if (emb === undefined) {
        out.push(c);
        continue;
      }
      let dominated = false;
      for (const existing of out) {
        if (existing.documentId !== c.documentId) continue;
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

/**
 * Cosine similarity: `(a · b) / (||a|| · ||b||)`. Returns 0 for a
 * length mismatch or a zero-magnitude vector, so a pathological
 * embedding never yields `NaN` and never trips the threshold.
 */
function cosineSim(a: Float32Array, b: Float32Array): number {
  if (a.length !== b.length) return 0;
  let dot = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < a.length; i++) {
    const ai = a[i] ?? 0;
    const bi = b[i] ?? 0;
    dot += ai * bi;
    normA += ai * ai;
    normB += bi * bi;
  }
  if (normA === 0 || normB === 0) return 0;
  return dot / (Math.sqrt(normA) * Math.sqrt(normB));
}
