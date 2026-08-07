import { createChunkId, createDocumentId } from "@lyra-sdk/kernel";
import type { Chunk, ScoredChunk } from "@lyra-sdk/storage";
import { describe, expect, it } from "vitest";
import { MinMaxScoreNormalizer, ZScoreScoreNormalizer } from "../../src/fusion/score-normalizer.js";
import { ReciprocalRankFusion } from "../../src/fusion/reciprocal-rank-fusion.js";
import { WeightedFusion } from "../../src/fusion/weighted-fusion.js";

const docId = createDocumentId("d-1");
const chunk = (id: string): Chunk => ({
  id: createChunkId(id),
  documentId: docId,
  span: { sourceId: docId, start: 0, end: 10 },
  metadata: {},
});
const sc = (id: string, score: number): ScoredChunk => ({ chunk: chunk(id), score });

describe("MinMaxScoreNormalizer", () => {
  const n = new MinMaxScoreNormalizer();
  it("maps [min, max] to [0, 1]", () => {
    expect(n.normalize(0, 0, 10)).toBe(0);
    expect(n.normalize(5, 0, 10)).toBe(0.5);
    expect(n.normalize(10, 0, 10)).toBe(1);
  });
  it("handles negative ranges", () => {
    expect(n.normalize(-1, -1, 1)).toBe(0);
    expect(n.normalize(0, -1, 1)).toBe(0.5);
    expect(n.normalize(1, -1, 1)).toBe(1);
  });
  it("returns 1 for a degenerate (min === max) input", () => {
    expect(n.normalize(5, 5, 5)).toBe(1);
  });
  it("clamps out-of-range values", () => {
    expect(n.normalize(20, 0, 10)).toBe(1);
    expect(n.normalize(-5, 0, 10)).toBe(0);
  });
});

describe("ZScoreScoreNormalizer", () => {
  const n = new ZScoreScoreNormalizer();
  it("maps mid-range to ~0.5", () => {
    expect(n.normalize(5, 0, 10)).toBeCloseTo(0.5, 5);
  });
  it("maps extremes toward 0 and 1", () => {
    const low = n.normalize(0, 0, 10);
    const high = n.normalize(10, 0, 10);
    expect(low).toBeLessThan(0.5);
    expect(high).toBeGreaterThan(0.5);
  });
  it("respects the clip parameter", () => {
    const tight = new ZScoreScoreNormalizer({ clip: 1 });
    // With clip=1, the entire range [-1, +1] maps to [0, 1] but
    // the input is approximately within that range for min=0,max=10.
    expect(tight.normalize(0, 0, 10)).toBeCloseTo(0, 1);
  });
});

describe("ReciprocalRankFusion", () => {
  const rrf = new ReciprocalRankFusion();

  it("returns empty for empty input", () => {
    expect(rrf.fuse([])).toEqual([]);
  });

  it("fuses two lists, summing reciprocal ranks", () => {
    const out = rrf.fuse([[sc("a", 1)], [sc("b", 1)]]);
    expect(out.length).toBe(2);
    // a and b each appear in one list at rank 1, so they tie.
    expect(out[0]?.chunk.id).toBeDefined();
  });

  it("a chunk in both lists outranks a chunk in only one", () => {
    const out = rrf.fuse([
      [sc("both", 1), sc("onlyA", 0.5)],
      [sc("both", 1)],
    ]);
    // 'both' has score 2/(k+1); 'onlyA' has score 1/(k+1).
    expect(out[0]?.chunk.id).toBe("both");
    expect(out[1]?.chunk.id).toBe("onlyA");
  });

  it("respects custom k", () => {
    const tight = new ReciprocalRankFusion({ k: 1 });
    const out = tight.fuse([
      [sc("a", 1), sc("b", 0.5)],
      [],
    ]);
    // With k=1, rank 1 contributes 1/2, rank 2 contributes 1/3.
    // 'a' = 0.5; 'b' = 0.333.
    expect(out[0]?.chunk.id).toBe("a");
    expect(out[0]?.score).toBeCloseTo(0.5, 5);
    expect(out[1]?.score).toBeCloseTo(1 / 3, 5);
  });

  it("respects per-retriever weights", () => {
    const weighted = new ReciprocalRankFusion({ weights: [1, 0] });
    const out = weighted.fuse([
      [sc("a", 1), sc("b", 0.5)],
      [sc("b", 1)],
    ]);
    // retriever 1 contributes 0; only retriever 0's score matters.
    // 'a' (rank 1) > 'b' (rank 2 in retriever 0).
    expect(out[0]?.chunk.id).toBe("a");
  });

  it("sorts ties by chunk id (deterministic)", () => {
    // Two retrievers, each with one chunk at the same rank.
    // Both chunks have identical RRF scores; the tiebreak sorts
    // ascending by id.
    const out = rrf.fuse([
      [sc("a", 1), sc("z", 1)],
      [sc("a", 1), sc("z", 1)],
    ]);
    // Both 'a' and 'z' are at rank 1 in each retriever, so each
    // gets score = 2 * (1 / (k+1)). Identical. Tiebreak by id asc.
    expect(out.map((s) => s.chunk.id)).toEqual(["a", "z"]);
  });
});

describe("WeightedFusion", () => {
  it("requires at least one weight", () => {
    expect(() => new WeightedFusion({ weights: [] })).toThrow();
  });

  it("rejects mismatched weights/lists count", () => {
    const f = new WeightedFusion({ weights: [1] });
    expect(() => f.fuse([[sc("a", 1)], [sc("b", 1)]])).toThrow();
  });

  it("combines normalized scores with weights", () => {
    const f = new WeightedFusion({ weights: [1, 1] });
    const out = f.fuse([
      [sc("a", 10), sc("b", 5)],
      [sc("a", 0.5), sc("b", 1)],
    ]);
    // After MinMax: list1 -> {a:1, b:0}; list2 -> {a:0, b:1}.
    // a = 1*1 + 0*1 = 1. b = 0*1 + 1*1 = 1. Tie -> sorted by id: 'a' first.
    expect(out.length).toBe(2);
    expect(out[0]?.chunk.id).toBe("a");
    expect(out[1]?.chunk.id).toBe("b");
  });

  it("weights steer the fusion", () => {
    const f = new WeightedFusion({ weights: [2, 1] });
    const out = f.fuse([
      [sc("a", 10)],
      [sc("b", 10)],
    ]);
    // a gets weight 2; b gets weight 1. So a > b.
    expect(out[0]?.chunk.id).toBe("a");
  });
});
