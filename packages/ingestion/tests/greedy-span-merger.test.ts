import { createDocumentId } from "@lyra-sdk/kernel";
import { describe, expect, it } from "vitest";
import { GreedySpanMerger } from "../src/merge/greedy-span-merger.js";

const doc = createDocumentId("doc-1");
const span = (start: number, end: number) => ({ sourceId: doc, start, end });

describe("GreedySpanMerger", () => {
  it("returns empty for empty input", () => {
    const m = new GreedySpanMerger();
    expect(m.merge([])).toEqual([]);
  });

  it("packs small spans into one", () => {
    const m = new GreedySpanMerger({ chunkSize: 100 });
    const out = m.merge([span(0, 5), span(5, 10), span(10, 15)]);
    expect(out).toEqual([{ sourceId: doc, start: 0, end: 15 }]);
  });

  it("rolls over when adding the next span would exceed chunkSize", () => {
    const m = new GreedySpanMerger({ chunkSize: 10 });
    const out = m.merge([span(0, 5), span(5, 12), span(12, 18)]);
    // [0,5] (5) + [5,12] (7) = 12 > 10 → emit [0,5].
    // [5,12] (7) + [12,18] (6) = 13 > 10 → emit [5,12]; [12,18] starts new group, then emitted.
    expect(out).toEqual([
      { sourceId: doc, start: 0, end: 5 },
      { sourceId: doc, start: 5, end: 12 },
      { sourceId: doc, start: 12, end: 18 },
    ]);
  });

  it("emits the final group", () => {
    const m = new GreedySpanMerger({ chunkSize: 5 });
    const out = m.merge([span(0, 3)]);
    expect(out).toEqual([{ sourceId: doc, start: 0, end: 3 }]);
  });

  it("preserves the sourceId from the first input", () => {
    const m = new GreedySpanMerger();
    const out = m.merge([span(0, 3), span(3, 6)]);
    expect(out[0]?.sourceId).toBe(doc);
  });
});
