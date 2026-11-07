import { createChunkId, createDocumentId } from "@lyra-sdk/kernel";
import type { ContextChunk } from "../../../src/types/index.js";
import { makeCitation } from "../../../src/citations/index.js";
import { MetadataStrippingCompressor } from "../../../src/transform/compression/metadata-stripping-compressor.js";
import { HeadTruncatingCompressor } from "../../../src/transform/compression/head-truncating-compressor.js";
import { CenterTruncatingCompressor } from "../../../src/transform/compression/center-truncating-compressor.js";
import { describe, expect, it } from "vitest";

function chunk(text: string): ContextChunk {
  const docId = createDocumentId("doc-1");
  return {
    chunkId: createChunkId("c"),
    documentId: docId,
    text,
    score: 0.5,
    span: { start: 0, end: text.length, sourceId: docId },
    citation: makeCitation({ documentId: docId, chunkId: createChunkId("c") }),
    timestamp: 1000,
    speaker: "alice",
  };
}

describe("MetadataStrippingCompressor", () => {
  it("strips optional fields except text, score, citation, join keys", () => {
    const r = new MetadataStrippingCompressor();
    const c = chunk("hello world");
    const out = r.compress([c]);
    expect(out[0]?.text).toBe("hello world");
    expect(out[0]?.score).toBe(0.5);
    expect(out[0]?.citation).toBeDefined();
    expect(out[0]?.chunkId).toBeDefined();
    expect(out[0]?.documentId).toBeDefined();
  });

  it("keeps timestamp and speaker and drops embedding and metadata", () => {
    const r = new MetadataStrippingCompressor();
    const c = { ...chunk("hello"), embedding: new Float32Array([1, 0]), metadata: { title: "T" } };
    const out = r.compress([c]);
    expect(out[0]?.timestamp).toBe(1000);
    expect(out[0]?.speaker).toBe("alice");
    expect(out[0]?.metadata).toBeUndefined();
    expect(out[0]?.embedding).toBeUndefined();
  });
});

describe("HeadTruncatingCompressor", () => {
  it("rejects invalid maxChars", () => {
    expect(() => new HeadTruncatingCompressor(0)).toThrow();
    expect(() => new HeadTruncatingCompressor(-1)).toThrow();
    expect(() => new HeadTruncatingCompressor(1.5)).toThrow();
  });

  it("leaves short chunks unchanged", () => {
    const r = new HeadTruncatingCompressor(100);
    const out = r.compress([chunk("short")]);
    expect(out[0]?.text).toBe("short");
  });

  it("truncates long chunks at the head, appends '...'", () => {
    const r = new HeadTruncatingCompressor(5);
    const c = chunk("a long chunk of text");
    const out = r.compress([c]);
    expect(out[0]?.text).toBe("a lon...");
    expect(out[0]?.span.end).toBe(c.span.end);
  });

  it("preserves citation, chunkId, documentId on truncation", () => {
    const r = new HeadTruncatingCompressor(5);
    const c = chunk("a long chunk of text");
    const out = r.compress([c]);
    expect(out[0]?.citation).toEqual(c.citation);
    expect(out[0]?.chunkId).toBe(c.chunkId);
    expect(out[0]?.documentId).toBe(c.documentId);
  });
});

describe("CenterTruncatingCompressor", () => {
  it("rejects negative headChars or tailChars", () => {
    expect(() => new CenterTruncatingCompressor(-1, 5)).toThrow();
    expect(() => new CenterTruncatingCompressor(5, -1)).toThrow();
  });

  it("rejects headChars + tailChars === 0", () => {
    expect(() => new CenterTruncatingCompressor(0, 0)).toThrow();
  });

  it("keeps head and tail, drops the middle with ...", () => {
    const r = new CenterTruncatingCompressor(3, 3);
    // "abcdefghijklmnop" is 16 chars; cap is 6 + 5 buffer = 11.
    const out = r.compress([chunk("abcdefghijklmnop")]);
    expect(out[0]?.text).toBe("abc...nop");
  });

  it("leaves short chunks unchanged", () => {
    const r = new CenterTruncatingCompressor(3, 3);
    const out = r.compress([chunk("abc")]);
    expect(out[0]?.text).toBe("abc");
  });
});
