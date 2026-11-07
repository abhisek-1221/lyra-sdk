import { createChunkId, createDocumentId, type TextSpan } from "@lyra-sdk/kernel";
import type { ContextChunk } from "../../../src/types/index.js";
import { makeCitation } from "../../../src/citations/index.js";
import { ExactDeduplicator } from "../../../src/transform/deduplication/exact-deduplicator.js";
import { AdjacentMerger } from "../../../src/transform/deduplication/adjacent-merger.js";
import { NearDeduplicator } from "../../../src/transform/deduplication/near-deduplicator.js";
import { DefaultDeduplicator } from "../../../src/transform/deduplication/default-deduplicator.js";
import { describe, expect, it } from "vitest";

function chunk(
  id: string,
  start: number,
  end: number,
  embedding: readonly number[] | undefined = undefined,
): ContextChunk {
  const docId = createDocumentId(`doc-${id}`);
  return {
    chunkId: createChunkId(id),
    documentId: docId,
    text: `text-${id}`,
    score: 0.5,
    span: { start, end, sourceId: docId },
    citation: makeCitation({ documentId: docId, chunkId: createChunkId(id) }),
    ...(embedding !== undefined ? { embedding: Float32Array.from(embedding) } : {}),
  };
}

describe("ExactDeduplicator", () => {
  it("drops duplicates with same document, chunkId, and span", async () => {
    const r = new ExactDeduplicator();
    const out = await r.deduplicate([
      chunk("a", 0, 10),
      chunk("a", 0, 10),
      chunk("b", 0, 10),
    ]);
    expect(out).toHaveLength(2);
  });

  it("keeps the same chunkId with different spans", async () => {
    const r = new ExactDeduplicator();
    const out = await r.deduplicate([chunk("a", 0, 10), chunk("a", 10, 20)]);
    expect(out).toHaveLength(2);
  });

  it("keeps the same chunkId and span in different documents", async () => {
    const r = new ExactDeduplicator();
    const docB = createDocumentId("other");
    const a = chunk("a", 0, 10);
    const other: ContextChunk = { ...a, documentId: docB, span: { ...a.span, sourceId: docB } };
    const out = await r.deduplicate([a, other]);
    expect(out).toHaveLength(2);
  });
});

const DOC = "0123456789abcdefghijKLMNOPQRSTUVWXYZ";

function sameDocChunk(
  id: string,
  start: number,
  end: number,
  text: string | undefined = undefined,
  embedding: readonly number[] | undefined = undefined,
): ContextChunk {
  const docId = createDocumentId("doc-1");
  return {
    chunkId: createChunkId(id),
    documentId: docId,
    text: text ?? DOC.slice(start, end),
    score: 0.5,
    span: { start, end, sourceId: docId },
    citation: makeCitation({ documentId: docId, chunkId: createChunkId(id) }),
    ...(embedding !== undefined ? { embedding: Float32Array.from(embedding) } : {}),
  };
}

function resolveSpan(_documentId: string, span: TextSpan): Promise<string> {
  return Promise.resolve(DOC.slice(span.start, span.end));
}

describe("AdjacentMerger", () => {
  it("merges consecutive spans and re-slices the union", async () => {
    const r = new AdjacentMerger();
    const out = await r.deduplicate(
      [sameDocChunk("a", 0, 10), sameDocChunk("b", 10, 20), sameDocChunk("c", 20, 30)],
      { resolveSpan },
    );
    expect(out).toHaveLength(1);
    expect(out[0]?.span.start).toBe(0);
    expect(out[0]?.span.end).toBe(30);
    expect(out[0]?.text).toBe(DOC.slice(0, 30));
  });

  it("merges overlapping spans, keeps the max score and the earliest timestamp", async () => {
    const r = new AdjacentMerger();
    const first = { ...sameDocChunk("a", 0, 15, "ignored", [1, 0]), score: 0.2, timestamp: 5 };
    const second = { ...sameDocChunk("b", 10, 20, "ignored"), score: 0.8, timestamp: 9 };
    const out = await r.deduplicate([second, first], { resolveSpan });
    expect(out).toHaveLength(1);
    expect(out[0]?.span).toMatchObject({ start: 0, end: 20 });
    expect(out[0]?.text).toBe(DOC.slice(0, 20));
    expect(out[0]?.score).toBe(0.8);
    expect(out[0]?.timestamp).toBe(5);
    expect(out[0]?.embedding).toBeUndefined();
    expect(out[0]?.chunkId).toBe(createChunkId("a"));
  });

  it("does not merge across document boundaries", async () => {
    const r = new AdjacentMerger();
    const out = await r.deduplicate(
      [sameDocChunk("a", 0, 10), sameDocChunk("b", 10, 20), chunk("c", 20, 30)],
      { resolveSpan },
    );
    expect(out).toHaveLength(2);
  });

  it("does not merge across a gap", async () => {
    const r = new AdjacentMerger();
    const out = await r.deduplicate([sameDocChunk("a", 0, 10), sameDocChunk("b", 15, 25)]);
    expect(out).toHaveLength(2);
  });

  it("keeps the absorbed chunk's citation in mergedCitations", async () => {
    const r = new AdjacentMerger();
    const out = await r.deduplicate([sameDocChunk("a", 0, 10), sameDocChunk("b", 10, 20)], { resolveSpan });
    expect(out).toHaveLength(1);
    expect(out[0]?.citation.key).toBe("doc-1:a");
    expect(out[0]?.mergedCitations?.map((c) => c.key)).toEqual(["doc-1:b"]);
  });

  it("accumulates citations across a three-way merge", async () => {
    const r = new AdjacentMerger();
    const out = await r.deduplicate(
      [sameDocChunk("a", 0, 10), sameDocChunk("b", 10, 20), sameDocChunk("c", 20, 30)],
      { resolveSpan },
    );
    expect(out[0]?.mergedCitations?.map((x) => x.key)).toEqual(["doc-1:b", "doc-1:c"]);
  });

  it("stitches already-resolved text when no span resolver is available", async () => {
    const r = new AdjacentMerger();
    const out = await r.deduplicate([sameDocChunk("a", 0, 15), sameDocChunk("b", 10, 20)]);
    expect(out).toHaveLength(1);
    expect(out[0]?.text).toBe(DOC.slice(0, 20));
  });

  it("keeps citations already merged into the first chunk", async () => {
    const r = new AdjacentMerger();
    const head = {
      ...sameDocChunk("a", 0, 10),
      mergedCitations: [makeCitation({ documentId: createDocumentId("doc-1"), chunkId: createChunkId("prior") })],
    };
    const out = await r.deduplicate([head, sameDocChunk("b", 10, 20)]);
    expect(out[0]?.mergedCitations?.map((c) => c.key)).toEqual(["doc-1:prior", "doc-1:b"]);
  });

  it("anchors the merge on the highest-scoring span", async () => {
    const r = new AdjacentMerger();
    const early = { ...sameDocChunk("a", 0, 10), score: 0.2 };
    const hit = { ...sameDocChunk("b", 10, 20), score: 0.9 };
    const out = await r.deduplicate([early, hit], { resolveSpan });
    expect(out[0]?.anchor).toMatchObject({ start: 10, end: 20 });
  });

  it("leaves mergedCitations unset when nothing is merged", async () => {
    const r = new AdjacentMerger();
    const out = await r.deduplicate([sameDocChunk("a", 0, 10), sameDocChunk("b", 15, 25)]);
    expect(out[0]?.mergedCitations).toBeUndefined();
    expect(out[1]?.mergedCitations).toBeUndefined();
  });
});

describe("NearDeduplicator", () => {
  it("rejects invalid threshold", () => {
    expect(() => new NearDeduplicator({ threshold: 0 })).toThrow();
    expect(() => new NearDeduplicator({ threshold: 1.5 })).toThrow();
  });

  it("drops the lower-scoring near-duplicate in the same document", async () => {
    const r = new NearDeduplicator({ threshold: 0.95 });
    const low = { ...sameDocChunk("a", 0, 10, undefined, [1, 0]), score: 0.2 };
    const high = { ...sameDocChunk("b", 20, 30, undefined, [1, 0]), score: 0.9 };
    const out = await r.deduplicate([low, high]);
    expect(out).toHaveLength(1);
    expect(out[0]?.chunkId).toBe(createChunkId("b"));
  });

  it("keeps near-duplicate embeddings from different documents", async () => {
    const r = new NearDeduplicator({ threshold: 0.95 });
    const out = await r.deduplicate([chunk("a", 0, 10, [1, 0]), chunk("b", 0, 10, [1, 0])]);
    expect(out).toHaveLength(2);
  });

  it("compares direction, not magnitude", async () => {
    const r = new NearDeduplicator({ threshold: 0.95 });
    const out = await r.deduplicate([
      sameDocChunk("a", 0, 10, undefined, [10, 1]),
      sameDocChunk("b", 20, 30, undefined, [1, 10]),
    ]);
    expect(out).toHaveLength(2);
  });

  it("treats parallel vectors of different magnitude as duplicates", async () => {
    const r = new NearDeduplicator({ threshold: 0.95 });
    const out = await r.deduplicate([
      sameDocChunk("a", 0, 10, undefined, [10, 0]),
      sameDocChunk("b", 20, 30, undefined, [3, 0]),
    ]);
    expect(out).toHaveLength(1);
  });

  it("keeps chunks with a zero-magnitude embedding", async () => {
    const r = new NearDeduplicator({ threshold: 0.95 });
    const out = await r.deduplicate([
      sameDocChunk("a", 0, 10, undefined, [0, 0]),
      sameDocChunk("b", 20, 30, undefined, [0, 0]),
    ]);
    expect(out).toHaveLength(2);
  });

  it("keeps chunks without embeddings", async () => {
    const r = new NearDeduplicator();
    const out = await r.deduplicate([sameDocChunk("a", 0, 10), sameDocChunk("b", 20, 30)]);
    expect(out).toHaveLength(2);
  });
});

describe("DefaultDeduplicator", () => {
  it("runs exact, then near, then span merge", async () => {
    const r = new DefaultDeduplicator();
    const a = sameDocChunk("a", 0, 10, undefined, [1, 0]);
    const b = sameDocChunk("b", 10, 20);
    const out = await r.deduplicate([a, a, b], { resolveSpan });
    expect(out).toHaveLength(1);
    expect(out[0]?.text).toBe(DOC.slice(0, 20));
    expect(out[0]?.mergedCitations?.map((c) => c.key)).toEqual(["doc-1:b"]);
  });
});
