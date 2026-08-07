import { describe, expect, it } from "vitest";
import { DotProductSimilarity } from "../src/similarity/dot-product-similarity.js";
import { EuclideanSimilarity } from "../src/similarity/euclidean-similarity.js";

describe("DotProductSimilarity", () => {
  const m = new DotProductSimilarity();

  it("computes the inner product", () => {
    expect(m.score(new Float32Array([1, 2, 3]), new Float32Array([4, 5, 6]))).toBe(32);
  });

  it("is zero for orthogonal vectors", () => {
    expect(m.score(new Float32Array([1, 0]), new Float32Array([0, 1]))).toBe(0);
  });

  it("throws on length mismatch", () => {
    expect(() => m.score(new Float32Array([1]), new Float32Array([1, 2]))).toThrow(/length/);
  });
});

describe("EuclideanSimilarity", () => {
  const m = new EuclideanSimilarity();

  it("returns 0 for identical vectors", () => {
    const v = new Float32Array([1, 2, 3]);
    expect(m.score(v, v)).toBeCloseTo(0, 6);
  });

  it("returns -distance for distinct vectors", () => {
    // (0,0) and (3,4) — distance is 5, score is -5.
    expect(m.score(new Float32Array([0, 0]), new Float32Array([3, 4]))).toBeCloseTo(-5, 6);
  });

  it("throws on length mismatch", () => {
    expect(() => m.score(new Float32Array([1]), new Float32Array([1, 2]))).toThrow(/length/);
  });
});
