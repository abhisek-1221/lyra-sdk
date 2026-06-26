import type { Embedding } from "../contracts/embedding.js";
import type { Embedder } from "../contracts/embedder.js";

/**
 * An `L2Normalizer` decorates an inner `Embedder` and returns
 * L2-normalized vectors. Each output vector has unit magnitude:
 *
 *   ||v||₂ = sqrt(Σ vᵢ²) = 1
 *
 * Why normalize? Cosine similarity reduces to a dot product on
 * unit-norm vectors — a single multiply-add per dimension instead
 * of a sqrt + two multiplies. The `BruteForceIndex` is unaffected
 * because the metric is the index's responsibility, not the
 * embedder's; the index's `CosineSimilarity` will produce the same
 * ranks whether vectors are pre-normalized or not. But pre-normalized
 * vectors let future metric implementations short-circuit, and they
 * are easier to reason about in storage.
 *
 * The decorator is a no-op for a zero-magnitude input (which is
 * pathological but possible if the inner embedder returns a zero
 * vector).
 */
export class L2Normalizer implements Embedder {
  constructor(private readonly inner: Embedder) {}

  public async embed(input: string): Promise<Embedding> {
    const emb = await this.inner.embed(input);
    return normalize(emb);
  }

  public async embedMany(inputs: readonly string[]): Promise<readonly Embedding[]> {
    if (inputs.length === 0) return [];
    const inner = await this.inner.embedMany(inputs);
    return inner.map(normalize);
  }
}

function normalize(emb: Embedding): Embedding {
  let sum = 0;
  for (let i = 0; i < emb.vector.length; i++) {
    sum += emb.vector[i]! * emb.vector[i]!;
  }
  const norm = Math.sqrt(sum);
  if (norm === 0) return emb;
  const out = new Float32Array(emb.vector.length);
  for (let i = 0; i < emb.vector.length; i++) {
    out[i] = emb.vector[i]! / norm;
  }
  return { id: emb.id, vector: out, model: emb.model, dimensions: emb.dimensions };
}
