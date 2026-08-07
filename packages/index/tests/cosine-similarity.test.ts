import { describe, expect, it } from "vitest";
import { CosineSimilarity } from "../src/similarity/cosine-similarity.js";

describe("CosineSimilarity", () => {
  it("returns 1 for identical vectors", () => {
    const m = new CosineSimilarity();
    const v = new Float32Array([1, 2, 3]);
    expect(m.score(v, v)).toBeCloseTo(1, 6);
  });

  it("returns 0 for orthogonal vectors", () => {
    const m = new CosineSimilarity();
    expect(m.score(new Float32Array([1, 0]), new Float32Array([0, 1]))).toBeCloseTo(0, 6);
  });

  it("returns -1 for opposite vectors", () => {
    const m = new CosineSimilarity();
    expect(m.score(new Float32Array([1, 0]), new Float32Array([-1, 0]))).toBeCloseTo(-1, 6);
  });

  it("is scale-invariant", () => {
    const m = new CosineSimilarity();
    const a = new Float32Array([1, 1, 1]);
    const b = new Float32Array([2, 2, 2]);
    expect(m.score(a, b)).toBeCloseTo(1, 6);
  });

  it("returns 0 for a zero-magnitude vector", () => {
    const m = new CosineSimilarity();
    expect(m.score(new Float32Array([0, 0]), new Float32Array([1, 1]))).toBe(0);
  });

  it("throws on length mismatch", () => {
    const m = new CosineSimilarity();
    expect(() => m.score(new Float32Array([1]), new Float32Array([1, 2]))).toThrow(/length/);
  });
});
