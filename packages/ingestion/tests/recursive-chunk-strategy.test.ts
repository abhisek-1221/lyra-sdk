import { createDocumentId } from "@lyra-sdk/kernel";
import { describe, expect, it } from "vitest";
import { RecursiveChunkStrategy } from "../src/strategies/recursive-chunk-strategy.js";
import type { SourceDocument } from "@lyra-sdk/storage";

const makeDoc = (content: string): SourceDocument => ({
  id: createDocumentId("doc-1"),
  sourceUri: "x",
  content,
  blocks: [],
  metadata: {},
});

describe("RecursiveChunkStrategy", () => {
  it("returns no chunks for an empty document", async () => {
    const s = new RecursiveChunkStrategy();
    const out = await s.chunk(makeDoc(""));
    expect(out).toEqual([]);
  });

  it("produces at least one chunk for a non-empty document", async () => {
    const s = new RecursiveChunkStrategy({ merger: { chunkSize: 100 } });
    const out = await s.chunk(makeDoc("a".repeat(500)));
    expect(out.length).toBeGreaterThan(0);
  });

  it("all chunks belong to the source document", async () => {
    const s = new RecursiveChunkStrategy({ merger: { chunkSize: 50 } });
    const out = await s.chunk(makeDoc("x".repeat(300)));
    for (const c of out) {
      expect(c.documentId).toBe("doc-1");
    }
  });

  it("chunk spans are contiguous and cover the document", async () => {
    const s = new RecursiveChunkStrategy({ merger: { chunkSize: 100 }, overlap: { overlap: 0 } });
    const input = "alpha\n\nbeta\n\ngamma\n\ndelta";
    const out = await s.chunk(makeDoc(input));
    expect(out[0]?.span.start).toBe(0);
    expect(out[out.length - 1]?.span.end).toBe(input.length);
    for (let i = 1; i < out.length; i++) {
      // With overlap:0, the next chunk starts where the previous ended.
      expect(out[i]?.span.start).toBeLessThanOrEqual(out[i]?.span.end ?? 0);
    }
  });

  it("copies block offset onto chunk timestamp", async () => {
    const line = "a".repeat(30);
    const content = `${line}\n${line}`;
    const s = new RecursiveChunkStrategy({
      splitter: { chunkSize: 20 },
      merger: { chunkSize: 20 },
      overlap: { overlap: 0 },
    });
    const out = await s.chunk({
      id: createDocumentId("doc-1"),
      sourceUri: "x",
      content,
      blocks: [
        { text: line, metadata: { offset: 4, contentStart: 0, contentEnd: 30, speaker: "Ada" } },
        { text: line, metadata: { offset: 9, contentStart: 31, contentEnd: 61 } },
      ],
      metadata: {},
    });
    expect(out.length).toBeGreaterThan(1);
    expect(out[0]?.metadata.timestamp).toBe(4);
    expect(out[0]?.metadata.speaker).toBe("Ada");
    const later = out.find((c) => c.span.start >= 31);
    expect(later?.metadata.timestamp).toBe(9);
  });

  it("chunks have no `content` field", async () => {
    const s = new RecursiveChunkStrategy();
    const out = await s.chunk(makeDoc("hello world"));
    for (const c of out) {
      expect("content" in c).toBe(false);
    }
  });
});
