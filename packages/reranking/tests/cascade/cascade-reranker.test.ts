import { createChunkId, createDocumentId } from "@lyra-sdk/kernel";
import type { ScoredChunk } from "@lyra-sdk/retrieval";
import type { Chunk } from "@lyra-sdk/storage";
import { describe, expect, it } from "vitest";
import { CascadeReranker } from "../../src/cascade/index.js";
import type { RerankResult, Reranker } from "../../src/contracts/index.js";

function makeChunk(id: string): Chunk {
  return {
    id: createChunkId(id),
    documentId: createDocumentId(`doc-${id}`),
    span: { start: 0, end: 1 },
    metadata: {},
  };
}

function scored(id: string, score: number): ScoredChunk {
  return { chunk: makeChunk(id), score };
}

class TagReranker implements Reranker {
  public calls: { query: string; count: number }[] = [];
  constructor(
    public readonly name: string,
    private readonly transform: (xs: readonly ScoredChunk[]) => readonly ScoredChunk[],
  ) {}
  async rerank(query: string, candidates: readonly ScoredChunk[]): Promise<RerankResult> {
    this.calls.push({ query, count: candidates.length });
    return { results: this.transform(candidates), durationMs: 0 };
  }
}

describe("CascadeReranker", () => {
  it("rejects empty stages", () => {
    expect(() => new CascadeReranker({ stages: [] })).toThrow();
  });

  it("applies stages in order, each consuming the previous output", async () => {
    const s1 = new TagReranker("s1", (xs) => xs.slice(0, 2));
    const s2 = new TagReranker("s2", (xs) => xs.slice(0, 1));
    const c = new CascadeReranker({ stages: [s1, s2] });
    const out = await c.rerank("q", [scored("a", 0.9), scored("b", 0.8), scored("c", 0.7)]);
    expect(out.results).toHaveLength(1);
    expect(out.results[0]?.chunk.id).toBe(createChunkId("a"));
    expect(s1.calls[0]?.count).toBe(3);
    expect(s2.calls[0]?.count).toBe(2);
  });

  it("diagnostics carry per-stage output sizes and durations", async () => {
    const s1 = new TagReranker("s1", (xs) => xs.slice(0, 2));
    const s2 = new TagReranker("s2", (xs) => xs.slice(0, 1));
    const c = new CascadeReranker({ stages: [s1, s2] });
    const out = await c.rerank("q", [scored("a", 0.9), scored("b", 0.8), scored("c", 0.7)]);
    const diag = out.diagnostics as {
      perStage: Record<string, { size: number; durationMs: number }>;
      stages: number;
    };
    expect(diag.perStage.s1?.size).toBe(2);
    expect(diag.perStage.s2?.size).toBe(1);
    expect(diag.stages).toBe(2);
  });

  it("name defaults to a chain of stage names", () => {
    const c = new CascadeReranker({
      stages: [new TagReranker("a", (xs) => xs), new TagReranker("b", (xs) => xs)],
    });
    expect(c.name).toBe("cascade-a->b");
  });

  it("passes the query through to every stage", async () => {
    const s1 = new TagReranker("s1", (xs) => xs);
    const s2 = new TagReranker("s2", (xs) => xs);
    const c = new CascadeReranker({ stages: [s1, s2] });
    await c.rerank("How does MCP work?", [scored("a", 0.5)]);
    expect(s1.calls[0]?.query).toBe("How does MCP work?");
    expect(s2.calls[0]?.query).toBe("How does MCP work?");
  });

  it("passes options.texts through to every stage when passTexts is true and lengths match", async () => {
    const s1 = new TagReranker("s1", (xs) => xs);
    const s2 = new TagReranker("s2", (xs) => xs);
    const c = new CascadeReranker({ stages: [s1, s2], passTexts: true });
    let lastTexts: readonly string[] | undefined;
    s2.rerank = async (q, cands, opts) => {
      lastTexts = opts?.texts;
      return { results: cands, durationMs: 0 };
    };
    await c.rerank("q", [scored("a", 0.5), scored("b", 0.5)], { texts: ["t-a", "t-b"] });
    expect(lastTexts).toEqual(["t-a", "t-b"]);
  });

  it("strips texts when passTexts is true but lengths no longer match", async () => {
    const s1 = new TagReranker("s1", (xs) => xs.slice(0, 1));
    const s2 = new TagReranker("s2", (xs) => xs);
    const c = new CascadeReranker({ stages: [s1, s2], passTexts: true });
    let lastTexts: readonly string[] | undefined;
    s2.rerank = async (q, cands, opts) => {
      lastTexts = opts?.texts;
      return { results: cands, durationMs: 0 };
    };
    await c.rerank("q", [scored("a", 0.5), scored("b", 0.5)], { texts: ["t-a", "t-b"] });
    expect(lastTexts).toBeUndefined();
  });

  it("preserves ScoredChunk identity through the cascade", async () => {
    const s1 = new TagReranker("s1", (xs) => [...xs].reverse());
    const c = new CascadeReranker({ stages: [s1] });
    const a = scored("a", 0.9);
    const b = scored("b", 0.5);
    const out = await c.rerank("q", [a, b]);
    expect(out.results[0]).toBe(b);
    expect(out.results[1]).toBe(a);
  });

  it("durationMs is the wall-clock of all stages", async () => {
    const s1: Reranker = {
      name: "slow",
      async rerank(_q, cands) {
        await new Promise((r) => setTimeout(r, 5));
        return { results: cands, durationMs: 5 };
      },
    };
    const c = new CascadeReranker({ stages: [s1] });
    const out = await c.rerank("q", [scored("a", 0.5)]);
    expect(out.durationMs).toBeGreaterThanOrEqual(5);
  });
});
