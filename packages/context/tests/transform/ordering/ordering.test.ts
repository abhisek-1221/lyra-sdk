import { createChunkId, createDocumentId } from "@lyra-sdk/kernel";
import type { ContextChunk } from "../../../src/types/index.js";
import { makeCitation } from "../../../src/citations/index.js";
import { ScoreOrdering } from "../../../src/transform/ordering/score-ordering.js";
import { SourceOrderOrdering } from "../../../src/transform/ordering/source-order-ordering.js";
import { TimestampOrdering } from "../../../src/transform/ordering/timestamp-ordering.js";
import { TranscriptOrdering } from "../../../src/transform/ordering/transcript-ordering.js";
import { ChronologicalOrdering } from "../../../src/transform/ordering/chronological-ordering.js";
import { describe, expect, it } from "vitest";

function chunk(
  id: string,
  score: number,
  extras: { doc?: string; ts?: number; start?: number; end?: number } = {},
): ContextChunk {
  return {
    chunkId: createChunkId(id),
    documentId: createDocumentId(extras.doc ?? `doc-${id}`),
    text: `text-${id}`,
    score,
    span: {
      start: extras.start ?? 0,
      end: extras.end ?? 10,
      sourceId: createDocumentId(extras.doc ?? `doc-${id}`),
    },
    citation: makeCitation({
      documentId: createDocumentId(extras.doc ?? `doc-${id}`),
      chunkId: createChunkId(id),
    }),
    ...(extras.ts !== undefined ? { timestamp: extras.ts } : {}),
  };
}

describe("ScoreOrdering", () => {
  it("orders by score desc", () => {
    const r = new ScoreOrdering();
    const out = r.order([chunk("a", 0.5), chunk("b", 0.9), chunk("c", 0.7)]);
    expect(out.map((c) => c.chunkId)).toEqual([
      createChunkId("b"),
      createChunkId("c"),
      createChunkId("a"),
    ]);
  });

  it("ties broken by chunkId asc", () => {
    const r = new ScoreOrdering();
    const out = r.order([chunk("z", 0.5), chunk("a", 0.5)]);
    expect(out.map((c) => c.chunkId)).toEqual([createChunkId("a"), createChunkId("z")]);
  });

  it("does not mutate input", () => {
    const r = new ScoreOrdering();
    const input = [chunk("a", 0.5), chunk("b", 0.9)];
    const snapshot = [...input];
    r.order(input);
    expect(input).toEqual(snapshot);
  });
});

describe("SourceOrderOrdering", () => {
  it("orders by (documentId, span.start)", () => {
    const r = new SourceOrderOrdering();
    const out = r.order([
      chunk("a", 0.5, { doc: "doc1", start: 20 }),
      chunk("b", 0.5, { doc: "doc1", start: 0 }),
      chunk("c", 0.5, { doc: "doc2", start: 5 }),
    ]);
    expect(out.map((c) => c.chunkId)).toEqual([
      createChunkId("b"),
      createChunkId("a"),
      createChunkId("c"),
    ]);
  });
});

describe("TimestampOrdering", () => {
  it("orders by timestamp asc", () => {
    const r = new TimestampOrdering();
    const out = r.order([
      chunk("a", 0.5, { ts: 2000 }),
      chunk("b", 0.5, { ts: 1000 }),
      chunk("c", 0.5, { ts: 3000 }),
    ]);
    expect(out.map((c) => c.chunkId)).toEqual([
      createChunkId("b"),
      createChunkId("a"),
      createChunkId("c"),
    ]);
  });

  it("chunks without a timestamp fall to the end", () => {
    const r = new TimestampOrdering();
    const out = r.order([
      chunk("a", 0.5),
      chunk("b", 0.5, { ts: 1000 }),
      chunk("c", 0.5),
    ]);
    expect(out.map((c) => c.chunkId)).toEqual([
      createChunkId("b"),
      createChunkId("a"),
      createChunkId("c"),
    ]);
  });
});

describe("ChronologicalOrdering", () => {
  it("orders by document createdAt asc", () => {
    const r = new ChronologicalOrdering((doc) => {
      if (doc === "doc1") return 1000;
      if (doc === "doc2") return 2000;
      return undefined;
    });
    const out = r.order([
      chunk("a", 0.5, { doc: "doc2" }),
      chunk("b", 0.5, { doc: "doc1" }),
    ]);
    expect(out.map((c) => c.chunkId)).toEqual([createChunkId("b"), createChunkId("a")]);
  });

  it("documents without a createdAt fall to the end", () => {
    const r = new ChronologicalOrdering((doc) => (doc === "doc1" ? 1000 : undefined));
    const out = r.order([
      chunk("a", 0.5, { doc: "doc2" }),
      chunk("b", 0.5, { doc: "doc1" }),
    ]);
    expect(out.map((c) => c.chunkId)).toEqual([createChunkId("b"), createChunkId("a")]);
  });
});

describe("TranscriptOrdering", () => {
  it("transcripts first (by timestamp asc), then non-transcripts (by score desc)", () => {
    const r = new TranscriptOrdering();
    const out = r.order([
      chunk("a", 0.9), // non-transcript, high score
      chunk("b", 0.5, { ts: 2000 }),
      chunk("c", 0.5), // non-transcript, low score
      chunk("d", 0.5, { ts: 1000 }),
    ]);
    // Transcripts: d (ts=1000), b (ts=2000). Non-transcripts: a (0.9), c (0.5).
    expect(out.map((c) => c.chunkId)).toEqual([
      createChunkId("d"),
      createChunkId("b"),
      createChunkId("a"),
      createChunkId("c"),
    ]);
  });

  it("all-transcript list: ordered by timestamp asc", () => {
    const r = new TranscriptOrdering();
    const out = r.order([
      chunk("a", 0.5, { ts: 2000 }),
      chunk("b", 0.5, { ts: 1000 }),
    ]);
    expect(out.map((c) => c.chunkId)).toEqual([createChunkId("b"), createChunkId("a")]);
  });

  it("all-non-transcript list: ordered by score desc", () => {
    const r = new TranscriptOrdering();
    const out = r.order([chunk("a", 0.3), chunk("b", 0.9)]);
    expect(out.map((c) => c.chunkId)).toEqual([createChunkId("b"), createChunkId("a")]);
  });
});
