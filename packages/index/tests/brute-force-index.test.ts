import { createChunkId, KernelError } from "@lyra-sdk/kernel";
import { describe, expect, it } from "vitest";
import { BruteForceIndex } from "../src/vector/brute-force-index.js";
import { CosineSimilarity } from "../src/similarity/cosine-similarity.js";

const vec = (...values: number[]) => new Float32Array(values);
const id = createChunkId;

describe("BruteForceIndex", () => {
  it("starts empty", async () => {
    const idx = new BruteForceIndex(new CosineSimilarity());
    const s = idx.stats();
    expect(s.vectors).toBe(0);
    expect(s.dimensions).toBe(0);
    expect(await idx.search(vec(1, 0), 5)).toEqual([]);
  });

  it("upserts and searches", async () => {
    const idx = new BruteForceIndex(new CosineSimilarity());
    await idx.upsert([
      { id: id("a"), vector: vec(1, 0) },
      { id: id("b"), vector: vec(0, 1) },
      { id: id("c"), vector: vec(1, 1) },
    ]);
    const hits = await idx.search(vec(1, 0), 2);
    expect(hits.length).toBe(2);
    expect(hits[0]?.id).toBe("a");
    expect(hits[0]?.score).toBeCloseTo(1, 6);
  });

  it("returns hits in descending score order", async () => {
    const idx = new BruteForceIndex(new CosineSimilarity());
    await idx.upsert([
      { id: id("a"), vector: vec(1, 0) },
      { id: id("b"), vector: vec(0.5, 0.5) },
      { id: id("c"), vector: vec(0, 1) },
    ]);
    const hits = await idx.search(vec(1, 0), 3);
    expect(hits.map((h) => h.id)).toEqual(["a", "b", "c"]);
  });

  it("upsert with the same id overwrites the vector", async () => {
    const idx = new BruteForceIndex(new CosineSimilarity());
    await idx.upsert([{ id: id("a"), vector: vec(1, 0) }]);
    await idx.upsert([{ id: id("a"), vector: vec(0, 1) }]);
    expect(idx.stats().vectors).toBe(1);
    const hits = await idx.search(vec(0, 1), 1);
    expect(hits[0]?.id).toBe("a");
  });

  it("rejects changing dimensionality of an existing entry", async () => {
    const idx = new BruteForceIndex(new CosineSimilarity());
    await idx.upsert([{ id: id("a"), vector: vec(1, 0) }]);
    await expect(
      idx.upsert([{ id: id("a"), vector: vec(1, 0, 0) }]),
    ).rejects.toThrow(/dimensionality/);
  });

  it("rejects a query with mismatched dimensions", async () => {
    const idx = new BruteForceIndex(new CosineSimilarity());
    await idx.upsert([{ id: id("a"), vector: vec(1, 0) }]);
    await expect(idx.search(vec(1, 0, 0), 1)).rejects.toThrow(/dimensions/);
  });

  it("treats k=0 as empty result", async () => {
    const idx = new BruteForceIndex(new CosineSimilarity());
    await idx.upsert([{ id: id("a"), vector: vec(1, 0) }]);
    expect(await idx.search(vec(1, 0), 0)).toEqual([]);
  });

  it("returns at most k hits", async () => {
    const idx = new BruteForceIndex(new CosineSimilarity());
    await idx.upsert(
      Array.from({ length: 10 }, (_, i) => ({ id: id(`c${i}`), vector: vec(1, 0) })),
    );
    const hits = await idx.search(vec(1, 0), 3);
    expect(hits.length).toBe(3);
  });

  it("delete is idempotent", async () => {
    const idx = new BruteForceIndex(new CosineSimilarity());
    await idx.upsert([{ id: id("a"), vector: vec(1, 0) }]);
    await idx.delete(id("a"));
    await idx.delete(id("a"));
    expect(idx.stats().vectors).toBe(0);
  });

  it("stats reflects memory usage approximately", async () => {
    const idx = new BruteForceIndex(new CosineSimilarity());
    await idx.upsert([{ id: id("a"), vector: vec(1, 0) }]);
    const s = idx.stats();
    expect(s.vectors).toBe(1);
    expect(s.dimensions).toBe(2);
    expect(s.memoryUsage).toBeGreaterThan(0);
  });
});
