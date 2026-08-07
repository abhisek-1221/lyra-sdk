import { createChunkId, createDocumentId } from "@lyra-sdk/kernel";
import type { ContextChunk } from "../../../src/types/index.js";
import { makeCitation } from "../../../src/citations/index.js";
import { IdentityExpander } from "../../../src/transform/expansion/identity-expander.js";
import { TranscriptExpander } from "../../../src/transform/expansion/transcript-expander.js";
import { describe, expect, it } from "vitest";

function chunk(
  id: string,
  ts: number | undefined,
  doc = "doc-1",
): ContextChunk {
  const docId = createDocumentId(doc);
  return {
    chunkId: createChunkId(id),
    documentId: docId,
    text: `text-${id}`,
    score: 0.5,
    span: { start: 0, end: 10, sourceId: docId },
    citation: makeCitation({ documentId: docId, chunkId: createChunkId(id) }),
    ...(ts !== undefined ? { timestamp: ts } : {}),
  };
}

describe("IdentityExpander", () => {
  it("returns the input unchanged", () => {
    const r = new IdentityExpander();
    const input = [chunk("a", 1000), chunk("b", 2000)];
    const out = r.expand(input);
    expect(out).toBe(input);
  });
});

describe("TranscriptExpander", () => {
  it("rejects negative windowMs", () => {
    expect(() => new TranscriptExpander({ windowMs: -1 })).toThrow();
  });

  it("rejects negative maxAddedChars", () => {
    expect(() => new TranscriptExpander({ maxAddedChars: -1 })).toThrow();
  });

  it("returns the input unchanged when no chunks have timestamps", () => {
    const r = new TranscriptExpander();
    const input = [chunk("a", undefined), chunk("b", undefined)];
    const out = r.expand(input);
    expect(out).toEqual(input);
  });

  it("pulls in adjacent chunks within the time window", () => {
    // The user "selected" a; the corpus has a, b, c, d.
    const corpus = [
      chunk("a", 1000),
      chunk("b", 5000),
      chunk("c", 10_000),
      chunk("d", 100_000), // 99s after a; outside window
    ];
    const r = new TranscriptExpander({ windowMs: 30_000, corpus });
    const out = r.expand([chunk("a", 1000)]);
    const ids = out.map((c) => c.chunkId);
    expect(ids).toContain(createChunkId("a"));
    expect(ids).toContain(createChunkId("b"));
    expect(ids).toContain(createChunkId("c"));
    expect(ids).not.toContain(createChunkId("d"));
  });

  it("pulls in adjacent chunks in both directions", () => {
    const corpus = [chunk("a", 0), chunk("b", 1000)];
    const r = new TranscriptExpander({ windowMs: 30_000, corpus });
    const out = r.expand([chunk("a", 0)]);
    // a is selected, b is within 30s of a in the corpus.
    expect(out).toHaveLength(2);
  });

  it("dedupes when multiple selected chunks ask for the same neighbor", () => {
    const corpus = [chunk("a", 0), chunk("b", 1000), chunk("c", 2000)];
    const r = new TranscriptExpander({ windowMs: 30_000, corpus });
    // Both a and b are selected; both pull in c.
    const out = r.expand([chunk("a", 0), chunk("b", 1000)]);
    const ids = out.map((c) => String(c.chunkId));
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("respects maxAddedChars", () => {
    const corpus = [chunk("a", 0), chunk("b", 1000), chunk("c", 2000)];
    const r = new TranscriptExpander({ windowMs: 30_000, maxAddedChars: 8, corpus });
    // text-? is 6 chars; b adds 6 (total 6), c would add 6 (total 12 > 8).
    const out = r.expand([chunk("a", 0)]);
    const ids = out.map((c) => c.chunkId);
    expect(ids).toContain(createChunkId("a"));
    expect(ids).toContain(createChunkId("b"));
    expect(ids).not.toContain(createChunkId("c"));
  });

  it("skips an oversized candidate but keeps scanning for smaller ones", () => {
    const big: ContextChunk = { ...chunk("big", 1000), text: "x".repeat(50) };
    const corpus = [chunk("a", 0), big, chunk("c", 2000)];
    const r = new TranscriptExpander({ windowMs: 30_000, maxAddedChars: 10, corpus });
    const out = r.expand([chunk("a", 0)]);
    const ids = out.map((c) => c.chunkId);
    // `big` (50 chars) does not fit, but `text-c` (6 chars) still does.
    expect(ids).not.toContain(createChunkId("big"));
    expect(ids).toContain(createChunkId("c"));
  });

  it("does not abandon later seeds when an earlier one has an oversized neighbor", () => {
    const big: ContextChunk = { ...chunk("big", 1000, "doc-1"), text: "x".repeat(50) };
    const corpus = [chunk("a", 0, "doc-1"), big, chunk("d", 0, "doc-2"), chunk("e", 1000, "doc-2")];
    const r = new TranscriptExpander({ windowMs: 30_000, maxAddedChars: 10, corpus });
    const out = r.expand([chunk("a", 0, "doc-1"), chunk("d", 0, "doc-2")]);
    expect(out.map((c) => c.chunkId)).toContain(createChunkId("e"));
  });

  it("does not pull in chunks from other documents", () => {
    const corpus = [
      chunk("a", 0, "doc-1"),
      chunk("b", 1000, "doc-1"),
      chunk("c", 2000, "doc-2"),
    ];
    const r = new TranscriptExpander({ windowMs: 30_000, corpus });
    const out = r.expand([chunk("a", 0, "doc-1")]);
    const docs = out.map((c) => c.documentId);
    expect(docs).not.toContain(createDocumentId("doc-2"));
  });
});
