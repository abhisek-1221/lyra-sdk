import { createChunkId } from "@lyra-sdk/kernel";
import { describe, expect, it } from "vitest";
import { bm25Idf } from "../../src/lexical/bm25/lexical-scorer.js";
import { BM25Scorer } from "../../src/lexical/bm25/bm25-scorer.js";
import { BM25PlusScorer } from "../../src/lexical/bm25/bm25-plus-scorer.js";

const id = createChunkId;

describe("bm25Idf", () => {
  it("is positive for any df in [1, N]", () => {
    expect(bm25Idf(1, 100)).toBeGreaterThan(0);
    expect(bm25Idf(50, 100)).toBeGreaterThan(0);
    expect(bm25Idf(99, 100)).toBeGreaterThan(0);
  });

  it("is monotonically decreasing in df", () => {
    expect(bm25Idf(1, 100)).toBeGreaterThan(bm25Idf(10, 100));
    expect(bm25Idf(10, 100)).toBeGreaterThan(bm25Idf(50, 100));
  });

  it("returns 0 for empty corpus", () => {
    expect(bm25Idf(0, 0)).toBe(0);
    expect(bm25Idf(5, 0)).toBe(0);
  });
});

describe("BM25Scorer", () => {
  const s = new BM25Scorer();

  it("returns 0 for a missing term", () => {
    expect(
      s.score({ term: "x", idf: 1.0, posting: undefined, docLength: 5, averageDocLength: 5 }),
    ).toBe(0);
  });

  it("returns 0 if average doc length is 0", () => {
    expect(
      s.score({
        term: "x",
        idf: 1.0,
        posting: { chunkId: id("a"), termFrequency: 1 },
        docLength: 5,
        averageDocLength: 0,
      }),
    ).toBe(0);
  });

  it("is increasing in term frequency (sub-linearly)", () => {
    const base = {
      term: "x",
      idf: 1.5,
      posting: { chunkId: id("a"), termFrequency: 1 } as const,
      docLength: 10,
      averageDocLength: 10,
    };
    const s1 = s.score(base);
    const s2 = s.score({ ...base, posting: { chunkId: id("a"), termFrequency: 2 } });
    const s5 = s.score({ ...base, posting: { chunkId: id("a"), termFrequency: 5 } });
    expect(s2).toBeGreaterThan(s1);
    expect(s5).toBeGreaterThan(s2);
    // Saturates — tf=5 should be less than 5x tf=1.
    expect(s5).toBeLessThan(s1 * 5);
  });

  it("penalizes longer documents", () => {
    const short = s.score({
      term: "x",
      idf: 1.0,
      posting: { chunkId: id("a"), termFrequency: 1 },
      docLength: 5,
      averageDocLength: 10,
    });
    const long = s.score({
      term: "x",
      idf: 1.0,
      posting: { chunkId: id("a"), termFrequency: 1 },
      docLength: 100,
      averageDocLength: 10,
    });
    expect(short).toBeGreaterThan(long);
  });

  it("honors the name contract", () => {
    expect(s.name).toBe("bm25");
  });
});

describe("BM25PlusScorer", () => {
  const s = new BM25PlusScorer();

  it("returns idf * delta for a missing term", () => {
    expect(
      s.score({ term: "x", idf: 2.0, posting: undefined, docLength: 5, averageDocLength: 5 }),
    ).toBeCloseTo(2.0 * 1.0, 6);
  });

  it("scores higher than plain BM25 for the same posting", () => {
    const bm25 = new BM25Scorer();
    const args = {
      term: "x",
      idf: 1.5,
      posting: { chunkId: id("a"), termFrequency: 2 } as const,
      docLength: 10,
      averageDocLength: 10,
    };
    expect(s.score(args)).toBeGreaterThan(bm25.score(args));
  });

  it("honors the name contract", () => {
    expect(s.name).toBe("bm25+");
  });
});
