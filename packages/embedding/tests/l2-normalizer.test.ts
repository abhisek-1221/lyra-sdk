import { describe, expect, it } from "vitest";
import type { Embedding } from "../src/contracts/embedding.js";
import type { Embedder } from "../src/contracts/embedder.js";
import { L2Normalizer } from "../src/normalization/l2-normalizer.js";

const emb = (v: number[]): Embedding => ({
  id: "e" as never,
  vector: new Float32Array(v),
  model: "m",
  dimensions: v.length,
});

class StubEmbedder implements Embedder {
  constructor(private readonly value: Embedding) {}
  async embed(_input: string): Promise<Embedding> {
    return this.value;
  }
  async embedMany(inputs: readonly string[]): Promise<readonly Embedding[]> {
    if (inputs.length === 0) return [];
    return [this.value];
  }
}

describe("L2Normalizer", () => {
  it("produces unit-norm vectors", async () => {
    const inner = new StubEmbedder(emb([3, 4]));
    const r = new L2Normalizer(inner);
    const out = await r.embed("x");
    const norm = Math.sqrt((out.vector[0] ?? 0) ** 2 + (out.vector[1] ?? 0) ** 2);
    expect(norm).toBeCloseTo(1, 6);
  });

  it("preserves the embedding id and dimensions", async () => {
    const inner = new StubEmbedder(emb([1, 0, 0]));
    const r = new L2Normalizer(inner);
    const out = await r.embed("x");
    expect(out.dimensions).toBe(3);
  });

  it("leaves a zero-magnitude vector unchanged", async () => {
    const inner = new StubEmbedder(emb([0, 0, 0]));
    const r = new L2Normalizer(inner);
    const out = await r.embed("x");
    expect([...out.vector]).toEqual([0, 0, 0]);
  });

  it("propagates embedMany", async () => {
    const inner = new StubEmbedder(emb([1, 1, 1]));
    const r = new L2Normalizer(inner);
    const out = await r.embedMany(["a", "b"]);
    expect(out.length).toBe(1);
    const norm = Math.sqrt(3 * ((out[0]?.vector[0] ?? 0) ** 2));
    expect(norm).toBeCloseTo(1, 6);
  });
});
