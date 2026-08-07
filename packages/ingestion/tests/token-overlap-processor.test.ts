import { createDocumentId } from "@lyra-sdk/kernel";
import { describe, expect, it } from "vitest";
import { TokenOverlapProcessor } from "../src/overlap/token-overlap-processor.js";

const doc = createDocumentId("doc-1");
const span = (start: number, end: number) => ({ sourceId: doc, start, end });

describe("TokenOverlapProcessor", () => {
  it("returns empty for empty input", () => {
    const p = new TokenOverlapProcessor();
    expect(p.addOverlap([], { docLength: 0 })).toEqual([]);
  });

  it("leaves a single span unchanged", () => {
    const p = new TokenOverlapProcessor();
    const input = [span(0, 10)];
    const out = p.addOverlap(input, { overlap: 5, docLength: 10 });
    expect(out).toEqual(input);
  });

  it("slides the second span backward into the first by `overlap` chars", () => {
    const p = new TokenOverlapProcessor();
    const out = p.addOverlap([span(0, 10), span(10, 20)], { overlap: 3, docLength: 20 });
    expect(out[0]).toEqual(span(0, 10));
    expect(out[1]?.start).toBe(7); // 10 - 3
    expect(out[1]?.end).toBe(20);
  });

  it("clamps the overlap to the start of the document (no negative start)", () => {
    const p = new TokenOverlapProcessor();
    const out = p.addOverlap([span(0, 5), span(5, 10)], { overlap: 100, docLength: 10 });
    // Second span would start at 5-100=-95; clamped to first span's start (0).
    expect(out[1]?.start).toBe(0);
  });

  it("clamps the overlap to the document length", () => {
    const p = new TokenOverlapProcessor();
    const out = p.addOverlap([span(0, 10), span(10, 20)], { overlap: 5, docLength: 15 });
    expect(out[1]?.end).toBe(15);
  });

  it("returns input unchanged when overlap is 0", () => {
    const p = new TokenOverlapProcessor();
    const input = [span(0, 10), span(10, 20)];
    const out = p.addOverlap(input, { overlap: 0, docLength: 20 });
    expect(out).toEqual(input);
  });
});
