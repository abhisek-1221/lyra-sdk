import { createChunkId, createDocumentId } from "@lyra-sdk/kernel";
import type { Chunk, ScoredChunk } from "@lyra-sdk/retrieval";
import { describe, expect, it } from "vitest";
import { RecallAtK } from "../../src/metrics/recall-at-k.js";
import { PrecisionAtK } from "../../src/metrics/precision-at-k.js";
import { HitRate } from "../../src/metrics/hit-rate.js";
import { MeanReciprocalRank } from "../../src/metrics/mrr.js";
import { MeanAveragePrecision } from "../../src/metrics/map.js";
import { NDCG } from "../../src/metrics/ndcg.js";

const docId = createDocumentId("d-1");
const chunk = (id: string): Chunk => ({
  id: createChunkId(id),
  documentId: docId,
  span: { sourceId: docId, start: 0, end: 10 },
  metadata: {},
});
const sc = (id: string, score = 1): ScoredChunk => ({ chunk: chunk(id), score });

describe("RecallAtK", () => {
  it("returns 1 when all relevant chunks are in the top-k", () => {
    const m = new RecallAtK(3);
    expect(m.evaluate([sc("a"), sc("b")], [createChunkId("a"), createChunkId("b")])).toBe(1);
  });

  it("returns 0.5 when half of the relevant chunks are in the top-k", () => {
    const m = new RecallAtK(2);
    // 2 relevant total; 1 in top-2.
    expect(m.evaluate([sc("a"), sc("x")], [createChunkId("a"), createChunkId("b")])).toBe(0.5);
  });

  it("returns 0 for an empty ground truth", () => {
    expect(new RecallAtK(5).evaluate([sc("a")], [])).toBe(0);
  });

  it("returns 0 when no relevant chunk is retrieved", () => {
    expect(new RecallAtK(5).evaluate([sc("x"), sc("y")], [createChunkId("a")])).toBe(0);
  });

  it("has a name like 'recall@10'", () => {
    expect(new RecallAtK(10).name).toBe("recall@10");
  });
});

describe("PrecisionAtK", () => {
  it("returns 1 when all top-k are relevant", () => {
    const m = new PrecisionAtK(3);
    expect(m.evaluate([sc("a"), sc("b")], [createChunkId("a"), createChunkId("b")])).toBe(1);
  });

  it("returns 0.5 when half the top-k are relevant", () => {
    const m = new PrecisionAtK(2);
    expect(m.evaluate([sc("a"), sc("x")], [createChunkId("a")])).toBe(0.5);
  });

  it("returns 0 for empty predictions", () => {
    expect(new PrecisionAtK(5).evaluate([], [createChunkId("a")])).toBe(0);
  });
});

describe("HitRate", () => {
  it("returns 1 if any relevant chunk is in the top-k", () => {
    const m = new HitRate(3);
    expect(m.evaluate([sc("x"), sc("a"), sc("y")], [createChunkId("a")])).toBe(1);
  });

  it("returns 0 if no relevant chunk is in the top-k", () => {
    expect(new HitRate(3).evaluate([sc("x"), sc("y")], [createChunkId("a")])).toBe(0);
  });
});

describe("MeanReciprocalRank", () => {
  it("returns 1/k for the first relevant at rank k", () => {
    const m = new MeanReciprocalRank();
    expect(m.evaluate([sc("x"), sc("a"), sc("y")], [createChunkId("a")])).toBe(0.5);
  });

  it("returns 1 for the top hit being relevant", () => {
    expect(new MeanReciprocalRank().evaluate([sc("a"), sc("x")], [createChunkId("a")])).toBe(1);
  });

  it("returns 0 when no relevant is in the predictions", () => {
    expect(new MeanReciprocalRank().evaluate([sc("x")], [createChunkId("a")])).toBe(0);
  });
});

describe("MeanAveragePrecision", () => {
  it("computes average precision for one query", () => {
    const m = new MeanAveragePrecision();
    // 2 relevant; positions 0 and 2 in the predictions.
    // ap = (1/1 + 2/3) / 2 = 0.8333...
    const v = m.evaluate(
      [sc("a"), sc("x"), sc("b")],
      [createChunkId("a"), createChunkId("b")],
    );
    expect(v).toBeCloseTo(0.8333, 3);
  });

  it("returns 0 for an empty ground truth", () => {
    expect(new MeanAveragePrecision().evaluate([sc("a")], [])).toBe(0);
  });
});

describe("NDCG", () => {
  it("returns 1 when the top-k is the ideal ordering", () => {
    const m = new NDCG(3);
    expect(m.evaluate([sc("a"), sc("b")], [createChunkId("a"), createChunkId("b")])).toBe(1);
  });

  it("is lower when the relevant item is at a worse rank", () => {
    const m = new NDCG(3);
    const top = m.evaluate([sc("a"), sc("b")], [createChunkId("a"), createChunkId("b")]);
    const worse = m.evaluate([sc("x"), sc("y"), sc("a")], [createChunkId("a"), createChunkId("b")]);
    expect(worse).toBeLessThan(top);
  });

  it("returns 0 for an empty ground truth", () => {
    expect(new NDCG(3).evaluate([sc("a")], [])).toBe(0);
  });
});
