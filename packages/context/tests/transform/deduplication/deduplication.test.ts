import { createChunkId, createDocumentId } from "@lyra-sdk/kernel";
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
  it("drops duplicates with same chunkId and span", () => {
    const r = new ExactDeduplicator();
    const out = r.deduplicate([
      chunk("a", 0, 10),
      chunk("a", 0, 10),
      chunk("b", 0, 10),
    ]);
    expect(out).toHaveLength(2);
  });

  it("keeps the same chunkId with different spans", () => {
    const r = new ExactDeduplicator();
    const out = r.deduplicate([chunk("a", 0, 10), chunk("a", 10, 20)]);
    expect(out).toHaveLength(2);
  });
});

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
    text: text ?? `text-${id}`,
    score: 0.5,
    span: { start, end, sourceId: docId },
    citation: makeCitation({ documentId: docId, chunkId: createChunkId(id) }),
    ...(embedding !== undefined ? { embedding: Float32Array.from(embedding) } : {}),
  };
}

describe("AdjacentMerger", () => {
  it("merges consecutive spans in the same document", () => {
    const r = new AdjacentMerger();
    const out = r.deduplicate([
      sameDocChunk("a", 0, 10),
      sameDocChunk("b", 10, 20),
      sameDocChunk("c", 20, 30),
    ]);
    expect(out).toHaveLength(1);
    expect(out[0]?.span.start).toBe(0);
    expect(out[0]?.span.end).toBe(30);
    expect(out[0]?.text).toBe("text-a text-b text-c");
  });

  it("does not merge across document boundaries", () => {
    const r = new AdjacentMerger();
    const out = r.deduplicate([
      sameDocChunk("a", 0, 10), // doc-1
      sameDocChunk("b", 10, 20), // doc-1 (same as a)
      chunk("c", 20, 30), // doc-c
    ]);
    // a+b merge (same doc); c is its own.
    expect(out).toHaveLength(2);
  });

  it("does not merge non-consecutive spans (gap)", () => {
    const r = new AdjacentMerger();
    const out = r.deduplicate([
      sameDocChunk("a", 0, 10),
      sameDocChunk("b", 15, 25),
    ]);
    expect(out).toHaveLength(2);
  });
});

describe("NearDeduplicator", () => {
  it("rejects invalid threshold", () => {
    expect(() => new NearDeduplicator({ threshold: 0 })).toThrow();
    expect(() => new NearDeduplicator({ threshold: 1.5 })).toThrow();
  });

  it("drops the lower-scored near-duplicate (cosine above threshold)", () => {
    // Two vectors with cosine 1.0 (identical). The second will be dropped.
    const r = new NearDeduplicator({ threshold: 0.95 });
    const a = chunk("a", 0, 10, [1, 0]);
    const b = chunk("b", 0, 10, [1, 0]);
    const out = r.deduplicate([a, b]);
    expect(out).toHaveLength(1);
  });

  it("keeps the higher-scored one (chunkId tie break)", () => {
    const r = new NearDeduplicator({ threshold: 0.95 });
    const a = chunk("a", 0, 10, [1, 0]);
    a.score = 0.5;
    const b = chunk("b", 0, 10, [0.99, 0.01]); // near 1.0
    b.score = 0.9;
    const out = r.deduplicate([a, b]);
    // a is processed first; b is dropped because it's similar to a.
    expect(out).toHaveLength(1);
    expect(out[0]?.chunkId).toBe(createChunkId("a"));
  });

  it("keeps chunks without embeddings (cannot judge similarity)", () => {
    const r = new NearDeduplicator();
    const out = r.deduplicate([chunk("a", 0, 10), chunk("b", 0, 10)]);
    expect(out).toHaveLength(2);
  });
});

describe("DefaultDeduplicator", () => {
  it("runs exact, then adjacent, then near (cheap first)", () => {
    const r = new DefaultDeduplicator();
    const a = chunk("a", 0, 10, [1, 0]);
    const aDup = chunk("a", 0, 10, [1, 0]);
    const b = chunk("b", 10, 20, [0.99, 0.01]); // near-dup of a
    const out = r.deduplicate([a, aDup, b]);
    // exact: drops aDup. adjacent: a and b are adjacent -> merge.
    // near: only the merged chunk remains.
    expect(out).toHaveLength(1);
  });
});
