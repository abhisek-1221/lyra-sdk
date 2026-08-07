import { describe, expect, it } from "vitest";
import type { Embedding } from "../src/contracts/embedding.js";
import type { Embedder } from "../src/contracts/embedder.js";
import { TokenBatcher } from "../src/batching/token-batcher.js";

const emb = (v: number[]): Embedding => ({
  id: "e" as never,
  vector: new Float32Array(v),
  model: "m",
  dimensions: v.length,
});

class CountingEmbedder implements Embedder {
  public calls: readonly string[][] = [];
  constructor(private readonly dims: number) {}
  async embed(_input: string): Promise<Embedding> {
    return emb([1, 1]);
  }
  async embedMany(inputs: readonly string[]): Promise<readonly Embedding[]> {
    this.calls.push([...inputs]);
    return inputs.map(() => emb(new Array(this.dims).fill(1)));
  }
}

describe("TokenBatcher", () => {
  it("returns empty for empty input", async () => {
    const inner = new CountingEmbedder(2);
    const r = new TokenBatcher(inner);
    expect(await r.embedMany([])).toEqual([]);
  });

  it("makes a single call for a small input", async () => {
    const inner = new CountingEmbedder(2);
    const r = new TokenBatcher(inner, { maxTokensPerBatch: 1000, maxItemsPerBatch: 100 });
    await r.embedMany(["a", "b", "c"]);
    expect(inner.calls.length).toBe(1);
    expect(inner.calls[0]?.length).toBe(3);
  });

  it("partitions by item count", async () => {
    const inner = new CountingEmbedder(2);
    const r = new TokenBatcher(inner, { maxTokensPerBatch: 1_000_000, maxItemsPerBatch: 2 });
    await r.embedMany(["a", "b", "c", "d", "e"]);
    expect(inner.calls.length).toBe(3);
    expect(inner.calls[0]?.length).toBe(2);
    expect(inner.calls[1]?.length).toBe(2);
    expect(inner.calls[2]?.length).toBe(1);
  });

  it("partitions by token estimate (4 chars ≈ 1 token)", async () => {
    const inner = new CountingEmbedder(2);
    const r = new TokenBatcher(inner, { maxTokensPerBatch: 5, maxItemsPerBatch: 1000 });
    // Each input is 40 chars → ~10 tokens. 5-token cap forces splits.
    await r.embedMany(["a".repeat(40), "b".repeat(40), "c".repeat(40)]);
    expect(inner.calls.length).toBeGreaterThan(1);
  });

  it("preserves input order across batches", async () => {
    const inner = new CountingEmbedder(2);
    const r = new TokenBatcher(inner, { maxTokensPerBatch: 1_000_000, maxItemsPerBatch: 2 });
    const out = await r.embedMany(["a", "b", "c", "d", "e"]);
    expect(out.length).toBe(5);
  });
});
