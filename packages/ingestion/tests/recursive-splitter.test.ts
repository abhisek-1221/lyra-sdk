import { createDocumentId } from "@lyra-sdk/kernel";
import { describe, expect, it } from "vitest";
import { RecursiveSplitter } from "../src/segmentation/recursive-splitter.js";

const doc = createDocumentId("doc-1");

describe("RecursiveSplitter", () => {
  it("returns empty for empty content", () => {
    const s = new RecursiveSplitter();
    expect(s.split(doc, "")).toEqual([]);
  });

  it("returns a single span when content fits in chunkSize", () => {
    const s = new RecursiveSplitter({ chunkSize: 100 });
    const out = s.split(doc, "hello world");
    expect(out.length).toBe(1);
    expect(out[0]).toEqual({ sourceId: doc, start: 0, end: 11 });
  });

  it("splits at paragraph boundary when content exceeds chunkSize", () => {
    const s = new RecursiveSplitter({ chunkSize: 15 });
    const out = s.split(doc, "alpha\n\nbeta\n\ngamma");
    // 3 paragraphs separated by \n\n: "alpha\n\n" (7), "beta\n\n" (6), "gamma" (5).
    expect(out.length).toBe(3);
    expect(out[0]?.start).toBe(0);
    expect(out[0]?.end).toBe(7);
    expect(out[1]?.start).toBe(7);
    expect(out[1]?.end).toBe(13);
    expect(out[2]?.start).toBe(13);
    expect(out[2]?.end).toBe(18);
  });

  it("descends to line level when paragraph still exceeds chunkSize", () => {
    const s = new RecursiveSplitter({ chunkSize: 6 });
    const out = s.split(doc, "aaaa\nbbbb\ncccc");
    // Each line (5 chars + 1 newline) just under chunkSize; should split at \n.
    expect(out.length).toBeGreaterThanOrEqual(3);
    // The first span should not start at 0 if descending happened — instead we get pieces
    // that respect the \n separator.
    expect(out[0]?.start).toBe(0);
  });

  it("spans are contiguous and cover the input", () => {
    const s = new RecursiveSplitter({ chunkSize: 5 });
    const input = "x".repeat(50);
    const out = s.split(doc, input);
    expect(out[0]?.start).toBe(0);
    expect(out[out.length - 1]?.end).toBe(input.length);
    for (let i = 1; i < out.length; i++) {
      expect(out[i]?.start).toBe(out[i - 1]?.end);
    }
  });

  it("no span has start === end", () => {
    const s = new RecursiveSplitter({ chunkSize: 3 });
    const out = s.split(doc, "abcdefghij");
    for (const span of out) {
      expect(span.end).toBeGreaterThan(span.start);
    }
  });
});
