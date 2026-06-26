import { createChunkId, createDocumentId } from "@lyra-sdk/kernel";
import type { ScoredChunk } from "@lyra-sdk/retrieval";
import type { Chunk, SourceDocument } from "@lyra-sdk/storage";
import { DefaultContextBuilder } from "@lyra-sdk/context";
import { describe, expect, it } from "vitest";
import { ContextBenchmark } from "../../../src/benchmark/context/context-benchmark.js";
import type { ContextDataset, ContextExample } from "../../../src/benchmark/context/context-benchmark.js";

function chunk(id: string, score: number): ScoredChunk {
  const c: Chunk = {
    id: createChunkId(id),
    documentId: createDocumentId(`doc-${id}`),
    span: { start: 0, end: 10, sourceId: createDocumentId(`doc-${id}`) },
    metadata: {},
  };
  return { chunk: c, score };
}

function doc(id: string, content: string): SourceDocument {
  return {
    id: createDocumentId(id),
    sourceUri: `lyra://${id}`,
    content,
    blocks: [{ text: content, metadata: {} }],
    metadata: {},
  };
}

describe("ContextBenchmark", () => {
  it("runs over the dataset and reports coverage, dedup ratio, citation completeness", async () => {
    const example: ContextExample = {
      query: "q1",
      relevant: [createChunkId("c1"), createChunkId("c2")],
      expectedTokenBudget: 100,
    };
    const dataset: ContextDataset = { name: "ds", examples: [example] };
    const documents = new Map<string, SourceDocument>([
      ["doc-c1", doc("doc-c1", "x")],
      ["doc-c2", doc("doc-c2", "y")],
      ["doc-c3", doc("doc-c3", "z")],
    ]);
    const builder = new DefaultContextBuilder({ tokenBudget: 100, documents });
    const bench = new ContextBenchmark();
    const report = await bench.run({
      builder,
      dataset,
      retrieve: async () => [chunk("c1", 0.9), chunk("c2", 0.8), chunk("c3", 0.5)],
    });
    expect(report.totalQueries).toBe(1);
    expect(report.meanCoverage).toBe(1);
    expect(report.citationCompleteness).toBe(1);
  });

  it("uses the builder's name when no label is supplied", async () => {
    const dataset: ContextDataset = {
      name: "ds",
      examples: [{ query: "q", relevant: [], expectedTokenBudget: 100 }],
    };
    const builder = new DefaultContextBuilder({ tokenBudget: 100, documents: new Map() });
    const bench = new ContextBenchmark();
    const report = await bench.run({
      builder,
      dataset,
      retrieve: () => [],
    });
    expect(report.builderLabel).toBe("default");
  });

  it("uses a custom label when supplied", async () => {
    const dataset: ContextDataset = {
      name: "ds",
      examples: [{ query: "q", relevant: [], expectedTokenBudget: 100 }],
    };
    const builder = new DefaultContextBuilder({ tokenBudget: 100, documents: new Map() });
    const bench = new ContextBenchmark();
    const report = await bench.run({
      builder,
      dataset,
      retrieve: () => [],
      builderLabel: "transcript-builder",
    });
    expect(report.builderLabel).toBe("transcript-builder");
  });

  it("returns zeros for an empty dataset", async () => {
    const dataset: ContextDataset = { name: "empty", examples: [] };
    const builder = new DefaultContextBuilder({ tokenBudget: 100, documents: new Map() });
    const bench = new ContextBenchmark();
    const report = await bench.run({
      builder,
      dataset,
      retrieve: () => [],
    });
    expect(report.totalQueries).toBe(0);
    expect(report.meanUsedTokens).toBe(0);
    expect(report.meanCoverage).toBe(0);
    expect(report.citationCompleteness).toBe(0);
  });
});
