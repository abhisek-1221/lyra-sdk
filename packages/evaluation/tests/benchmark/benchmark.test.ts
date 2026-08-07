import { createChunkId, createDocumentId } from "@lyra-sdk/kernel";
import type { Chunk, ScoredChunk } from "@lyra-sdk/retrieval";
import type { RetrievalResult, Retriever } from "@lyra-sdk/retrieval";
import { describe, expect, it } from "vitest";
import { Benchmark } from "../../src/benchmark/benchmark.js";
import { GoldenDataset } from "../../src/datasets/golden-dataset.js";
import { HitRate } from "../../src/metrics/hit-rate.js";
import { MeanReciprocalRank } from "../../src/metrics/mrr.js";
import { NDCG } from "../../src/metrics/ndcg.js";
import { PrecisionAtK } from "../../src/metrics/precision-at-k.js";
import { RecallAtK } from "../../src/metrics/recall-at-k.js";

const docId = createDocumentId("d-1");
const chunk = (id: string): Chunk => ({
  id: createChunkId(id),
  documentId: docId,
  span: { sourceId: docId, start: 0, end: 10 },
  metadata: {},
});

class StubRetriever implements Retriever {
  public calls = 0;
  constructor(private readonly perCall: (q: string, k: number) => ScoredChunk[]) {}
  async retrieve(query: string, k: number): Promise<RetrievalResult> {
    this.calls++;
    return { query, results: this.perCall(query, k).slice(0, k), durationMs: 0 };
  }
}

describe("Benchmark", () => {
  it("runs every example through the retriever", async () => {
    const retriever = new StubRetriever(() => []);
    const dataset = new GoldenDataset({
      name: "t",
      examples: [
        { query: "q1", relevant: [createChunkId("a")] },
        { query: "q2", relevant: [createChunkId("b")] },
        { query: "q3", relevant: [createChunkId("c")] },
      ],
    });
    const benchmark = new Benchmark();
    const report = await benchmark.run({
      retriever,
      dataset,
      metrics: [new HitRate(5)],
      k: 5,
    });
    expect(retriever.calls).toBe(3);
    expect(report.totalQueries).toBe(3);
  });

  it("aggregates per-query metric values by mean", async () => {
    // Q1: 1 relevant, predicted → hit=1, mrr=1, ndcg=1
    // Q2: 1 relevant, not predicted → hit=0, mrr=0, ndcg=0
    const retriever = new StubRetriever((q) => {
      if (q === "q1") return [{ chunk: chunk("a"), score: 1 }];
      return [{ chunk: chunk("x"), score: 1 }];
    });
    const dataset = new GoldenDataset({
      name: "t",
      examples: [
        { query: "q1", relevant: [createChunkId("a")] },
        { query: "q2", relevant: [createChunkId("b")] },
      ],
    });
    const benchmark = new Benchmark();
    const report = await benchmark.run({
      retriever,
      dataset,
      metrics: [new HitRate(5), new MeanReciprocalRank(), new NDCG(5), new RecallAtK(5), new PrecisionAtK(5)],
      k: 5,
    });
    // Hit rate: 0.5; MRR: 0.5; NDCG: 0.5; Recall: 0.5; Precision: 0.5.
    expect(report.metrics["hit_rate@5"]).toBe(0.5);
    expect(report.metrics["mrr"]).toBe(0.5);
    expect(report.metrics["ndcg@5"]).toBe(0.5);
    expect(report.metrics["recall@5"]).toBe(0.5);
    expect(report.metrics["precision@5"]).toBe(0.5);
  });

  it("reports per-query scores", async () => {
    const retriever = new StubRetriever((q) =>
      q === "q1" ? [{ chunk: chunk("a"), score: 1 }] : [{ chunk: chunk("x"), score: 1 }],
    );
    const dataset = new GoldenDataset({
      name: "t",
      examples: [
        { query: "q1", relevant: [createChunkId("a")] },
        { query: "q2", relevant: [createChunkId("b")] },
      ],
    });
    const benchmark = new Benchmark();
    const report = await benchmark.run({
      retriever,
      dataset,
      metrics: [new HitRate(5)],
      k: 5,
    });
    expect(report.perQuery.length).toBe(2);
    expect(report.perQuery[0]?.query).toBe("q1");
    expect(report.perQuery[0]?.scores["hit_rate@5"]).toBe(1);
    expect(report.perQuery[1]?.scores["hit_rate@5"]).toBe(0);
  });

  it("uses the retrieverLabel when supplied", async () => {
    const retriever = new StubRetriever(() => []);
    const dataset = new GoldenDataset({ name: "t", examples: [] });
    const report = await new Benchmark().run({
      retriever,
      retrieverLabel: "MyRetriever",
      dataset,
      metrics: [new HitRate(5)],
      k: 5,
    });
    expect(report.retriever).toBe("MyRetriever");
  });

  it("handles an empty dataset", async () => {
    const retriever = new StubRetriever(() => []);
    const dataset = new GoldenDataset({ name: "t", examples: [] });
    const report = await new Benchmark().run({
      retriever,
      dataset,
      metrics: [new HitRate(5)],
      k: 5,
    });
    expect(report.totalQueries).toBe(0);
    expect(report.metrics).toEqual({});
  });
});
