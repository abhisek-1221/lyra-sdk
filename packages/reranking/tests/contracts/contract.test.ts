import { createChunkId, createDocumentId } from "@lyra-sdk/kernel";
import type { ScoredChunk } from "@lyra-sdk/retrieval";
import type { Chunk } from "@lyra-sdk/storage";
import { describe, expect, it } from "vitest";
import type { RerankResult, Reranker, RerankerOptions } from "../../src/index.js";

/**
 * The contract tests for the base `Reranker` interface. They
 * exercise the contract via a hand-written stub that:
 *   - preserves `ScoredChunk` identity when not reordering;
 *   - reports `durationMs` as a non-negative number;
 *   - accepts an optional `RerankerOptions`;
 *   - carries a non-empty `name` for benchmark reports.
 *
 * A second stub shows that a reranker MAY drop candidates
 * (a cascade-stage or threshold filter) without violating the
 * contract.
 */

function makeChunk(id: string): Chunk {
  return {
    id: createChunkId(id),
    documentId: createDocumentId(`doc-${id}`),
    span: { start: 0, end: 10 },
    metadata: {},
  };
}

function makeScored(id: string, score: number): ScoredChunk {
  return { chunk: makeChunk(id), score };
}

class IdentityReranker implements Reranker {
  public readonly name = "identity-reranker";
  public lastCall: { query: string; count: number; options?: RerankerOptions } | undefined;
  async rerank(
    query: string,
    candidates: readonly ScoredChunk[],
    options?: RerankerOptions,
  ): Promise<RerankResult> {
    this.lastCall = { query, count: candidates.length, options };
    const start = Date.now();
    return {
      results: candidates,
      durationMs: Date.now() - start,
    };
  }
}

class ThresholdReranker implements Reranker {
  public readonly name = "threshold-reranker";
  constructor(private readonly minScore: number) {}
  async rerank(
    _query: string,
    candidates: readonly ScoredChunk[],
  ): Promise<RerankResult> {
    const filtered = candidates.filter((c) => c.score >= this.minScore);
    return { results: filtered, durationMs: 0 };
  }
}

describe("Reranker contract", () => {
  it("rerank returns a RerankResult with results and a non-negative durationMs", async () => {
    const r = new IdentityReranker();
    const cands = [makeScored("a", 0.9), makeScored("b", 0.5)];
    const out = await r.rerank("q", cands);
    expect(out.results).toHaveLength(2);
    expect(out.durationMs).toBeGreaterThanOrEqual(0);
    expect(typeof out.durationMs).toBe("number");
  });

  it("rerank echoes the original query (does not transform it)", async () => {
    const r = new IdentityReranker();
    await r.rerank("How does MCP work?", [makeScored("a", 0.9)]);
    expect(r.lastCall?.query).toBe("How does MCP work?");
  });

  it("rerank accepts an optional RerankerOptions and forwards it", async () => {
    const r = new IdentityReranker();
    await r.rerank("q", [makeScored("a", 0.9)], { name: "trace-1" });
    expect(r.lastCall?.options?.name).toBe("trace-1");
  });

  it("rerank may drop candidates (filter contract)", async () => {
    const r = new ThresholdReranker(0.7);
    const out = await r.rerank("q", [
      makeScored("a", 0.9),
      makeScored("b", 0.3),
      makeScored("c", 0.7),
    ]);
    expect(out.results).toHaveLength(2);
    expect(out.results.map((c) => c.chunk.id)).toEqual([
      createChunkId("a"),
      createChunkId("c"),
    ]);
  });

  it("rerank may reorder candidates (reorder contract)", async () => {
    const r: Reranker = {
      name: "reverser",
      async rerank(_q, cands) {
        return { results: [...cands].reverse(), durationMs: 0 };
      },
    };
    const out = await r.rerank("q", [makeScored("a", 0.1), makeScored("b", 0.9)]);
    expect(out.results[0]?.chunk.id).toBe(createChunkId("b"));
    expect(out.results[1]?.chunk.id).toBe(createChunkId("a"));
  });

  it("rerank preserves ScoredChunk identity (no-mutation contract)", async () => {
    const r = new IdentityReranker();
    const c1 = makeScored("a", 0.9);
    const c2 = makeScored("b", 0.5);
    const out = await r.rerank("q", [c1, c2]);
    expect(out.results[0]).toBe(c1);
    expect(out.results[1]).toBe(c2);
  });

  it("every Reranker carries a non-empty name for benchmark reports", () => {
    expect(new IdentityReranker().name.length).toBeGreaterThan(0);
    expect(new ThresholdReranker(0.5).name.length).toBeGreaterThan(0);
  });

  it("empty input returns empty results with non-negative duration", async () => {
    const r = new IdentityReranker();
    const out = await r.rerank("q", []);
    expect(out.results).toEqual([]);
    expect(out.durationMs).toBeGreaterThanOrEqual(0);
  });

  it("RerankResult.diagnostics is optional and free-form", async () => {
    const r: Reranker = {
      name: "with-diagnostics",
      async rerank(_q, cands) {
        return {
          results: cands,
          durationMs: 0,
          diagnostics: { customKey: 42, nested: { ok: true } },
        };
      },
    };
    const out = await r.rerank("q", [makeScored("a", 0.9)]);
    expect(out.diagnostics).toEqual({ customKey: 42, nested: { ok: true } });
  });
});
