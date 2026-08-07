import { createChunkId, createDocumentId } from "@lyra-sdk/kernel";
import type { ContextChunk } from "../../src/types/index.js";
import { dedupeCitations, makeCitation, makeCitationKey } from "../../src/citations/index.js";
import { describe, expect, it } from "vitest";

describe("makeCitationKey", () => {
  it("formats as <documentId>:<chunkId>", () => {
    const key = makeCitationKey(createDocumentId("doc-1"), createChunkId("c-1"));
    expect(key).toBe("doc-1:c-1");
  });
});

describe("makeCitation", () => {
  it("builds a citation with key only", () => {
    const c = makeCitation({
      documentId: createDocumentId("doc-1"),
      chunkId: createChunkId("c-1"),
    });
    expect(c.key).toBe("doc-1:c-1");
    expect(c.label).toBeUndefined();
    expect(c.url).toBeUndefined();
  });

  it("includes label and url when supplied", () => {
    const c = makeCitation({
      documentId: createDocumentId("doc-1"),
      chunkId: createChunkId("c-1"),
      label: "Smith 2024",
      url: "https://example.com",
    });
    expect(c.label).toBe("Smith 2024");
    expect(c.url).toBe("https://example.com");
  });
});

describe("dedupeCitations", () => {
  it("dedupes by key, preserving first-seen order", () => {
    const a: ContextChunk["citation"] = { key: "k1" };
    const b: ContextChunk["citation"] = { key: "k2" };
    const c: ContextChunk["citation"] = { key: "k1" };
    const out = dedupeCitations([a, b, c]);
    expect(out).toHaveLength(2);
    expect(out[0]?.key).toBe("k1");
    expect(out[1]?.key).toBe("k2");
  });

  it("returns empty for empty input", () => {
    expect(dedupeCitations([])).toEqual([]);
  });
});
