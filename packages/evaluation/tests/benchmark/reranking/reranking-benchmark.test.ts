import { createChunkId, createDocumentId } from "@lyra-sdk/kernel";
import type { ScoredChunk } from "@lyra-sdk/retrieval";
import type { Chunk } from "@lyra-sdk/storage";
import { describe, expect, it } from "vitest";
import { MockJinaReranker, MockReverserReranker } from "../../../src/benchmark/scenarios/mock-rerankers.js";
import { RerankingBenchmark } from "../../../src/benchmark/reranking/reranking-benchmark.js";
import type { RetrievalDataset, RetrievalExample } from "../../../src/datasets/retrieval-dataset.js";
import type { Retriever, RetrievalResult } from "@lyra-sdk/retrieval";

function chunk(id: string, score: number): ScoredChunk {
  const c: Chunk = {
    id: createChunkId(id),
    documentId: createDocumentId(`doc-${id}`),
    span: { start: 0, end: 10, sourceId: createDocumentId(`doc-${id}`) },
    metadata: {},
  };
  return { chunk: c, score };
}

class StubRetriever implements Retriever {
  public calls: string[] = [];
  constructor(private readonly candidates: Map<string, ScoredChunk[]>) {}
  async retrieve(query: string, k: number): Promise<RetrievalResult> {
    this.calls.push(query);
    const cands = this.candidates.get(query) ?? [];
    return { query, results: cands.slice(0, k), durationMs: 0 };
  }
}

function example(query: string, relevant: string[]): RetrievalExample {
  return {
    query,
    relevant: relevant.map((id) => createChunkId(id)),
  };
}

describe("RerankingBenchmark", () => {
  it("runs over the dataset and reports mean recall, MRR, latency", async () => {
    const dataset: RetrievalDataset = {
      name: "test",
      examples: [
        example("q1", ["c1", "c2"]),
        example("q2", ["c3"]),
      ],
    };
    const retriever = new StubRetriever(
      new Map([
        ["q1", [chunk("c1", 0.9), chunk("c2", 0.8), chunk("c4", 0.5)]],
        ["q2", [chunk("c3", 0.9), chunk("c5", 0.5)]],
      ]),
    );
    const reranker = new MockReverserReranker();
    const bench = new RerankingBenchmark();
    const report = await bench.run({
      retriever,
      reranker,
      dataset,
      k: 3,
      rerankK: 2,
    });
    expect(report.totalQueries).toBe(2);
    expect(report.perQuery).toHaveLength(2);
    expect(report.meanRecall).toBeGreaterThanOrEqual(0);
    expect(report.meanMrr).toBeGreaterThanOrEqual(0);
  });

  it("uses custom labels when supplied", async () => {
    const dataset: RetrievalDataset = {
      name: "ds",
      examples: [example("q", ["c1"])],
    };
    const retriever = new StubRetriever(new Map([["q", [chunk("c1", 0.9)]]]));
    const bench = new RerankingBenchmark();
    const report = await bench.run({
      retriever,
      reranker: new MockJinaReranker(),
      dataset,
      k: 1,
      rerankK: 1,
      retrieverLabel: "stub-retriever",
      rerankerLabel: "stub-reranker",
    });
    expect(report.retrieverLabel).toBe("stub-retriever");
    expect(report.rerankerLabel).toBe("stub-reranker");
  });

  it("returns zero means for an empty dataset", async () => {
    const dataset: RetrievalDataset = { name: "empty", examples: [] };
    const retriever = new StubRetriever(new Map());
    const bench = new RerankingBenchmark();
    const report = await bench.run({
      retriever,
      reranker: new MockReverserReranker(),
      dataset,
      k: 5,
      rerankK: 3,
    });
    expect(report.totalQueries).toBe(0);
    expect(report.meanRecall).toBe(0);
    expect(report.meanMrr).toBe(0);
    expect(report.medianLatencyMs).toBe(0);
  });
});
