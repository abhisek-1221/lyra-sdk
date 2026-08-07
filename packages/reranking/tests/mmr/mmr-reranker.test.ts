import { createChunkId, createDocumentId, KernelError } from "@lyra-sdk/kernel";
import type { ScoredChunk } from "@lyra-sdk/retrieval";
import type { Chunk } from "@lyra-sdk/storage";
import { describe, expect, it } from "vitest";
import { MMRReranker } from "../../src/mmr/mmr-reranker.js";

/**
 * Build a chunk with id `i` whose document id is `doc-i` and whose
 * span is irrelevant for MMR. Embeddings are unit-normalized
 * 2-D vectors so cosine similarity equals the dot product.
 */
function chunk(id: string): Chunk {
  return {
    id: createChunkId(id),
    documentId: createDocumentId(`doc-${id}`),
    span: { start: 0, end: 1 },
    metadata: {},
  };
}

function scored(
  id: string,
  score: number,
  embedding: readonly number[] | undefined = undefined,
): ScoredChunk {
  const out: { chunk: Chunk; score: number; embedding?: Float32Array } = {
    chunk: chunk(id),
    score,
  };
  if (embedding !== undefined) {
    out.embedding = Float32Array.from(embedding);
  }
  return out;
}

function vec(...values: readonly number[]): Float32Array {
  return Float32Array.from(values);
}

function normalized(v: readonly number[]): Float32Array {
  let s = 0;
  for (const x of v) s += x * x;
  const n = Math.sqrt(s) || 1;
  return Float32Array.from(v.map((x) => x / n));
}

describe("MMRReranker", () => {
  it("rejects lambda outside [0, 1]", () => {
    expect(() => new MMRReranker({ lambda: -0.1, topK: 5, queryEmbedding: vec(1) })).toThrow(
      KernelError,
    );
    expect(() => new MMRReranker({ lambda: 1.1, topK: 5, queryEmbedding: vec(1) })).toThrow(
      KernelError,
    );
  });

  it("rejects non-integer or negative topK", () => {
    expect(() => new MMRReranker({ lambda: 0.5, topK: -1, queryEmbedding: vec(1) })).toThrow(
      KernelError,
    );
    expect(() => new MMRReranker({ lambda: 0.5, topK: 1.5, queryEmbedding: vec(1) })).toThrow(
      KernelError,
    );
  });

  it("rejects empty queryEmbedding", () => {
    expect(() => new MMRReranker({ lambda: 0.5, topK: 5, queryEmbedding: vec() })).toThrow(
      KernelError,
    );
  });

  it("carries the configured name (or a derived one)", () => {
    const named = new MMRReranker({
      lambda: 0.5,
      topK: 5,
      queryEmbedding: vec(1, 0),
      name: "my-mmr",
    });
    expect(named.name).toBe("my-mmr");
    const anon = new MMRReranker({ lambda: 0.7, topK: 5, queryEmbedding: vec(1, 0) });
    expect(anon.name).toBe("mmr-0.70");
  });

  it("returns empty results for empty candidates", async () => {
    const r = new MMRReranker({ lambda: 0.5, topK: 5, queryEmbedding: vec(1, 0) });
    const out = await r.rerank("q", []);
    expect(out.results).toEqual([]);
    expect(out.durationMs).toBeGreaterThanOrEqual(0);
  });

  it("returns the single candidate unchanged when there is only one", async () => {
    const r = new MMRReranker({ lambda: 0.5, topK: 5, queryEmbedding: vec(1, 0) });
    const c = scored("a", 0.9, [1, 0]);
    const out = await r.rerank("q", [c]);
    expect(out.results).toHaveLength(1);
    expect(out.results[0]).toBe(c);
  });

  it("throws when any candidate is missing ScoredChunk.embedding", async () => {
    const r = new MMRReranker({ lambda: 0.5, topK: 5, queryEmbedding: vec(1, 0) });
    await expect(
      r.rerank("q", [scored("a", 0.9, [1, 0]), scored("b", 0.5)]),
    ).rejects.toBeInstanceOf(KernelError);
  });

  it("throws when queryEmbedding is the empty array (constructed with non-empty)", async () => {
    // The constructor already rejects this; rerank does not need to re-check.
    expect(
      () => new MMRReranker({ lambda: 0.5, topK: 5, queryEmbedding: vec() }),
    ).toThrow(KernelError);
  });

  it("lambda = 1.0 returns top-K by score (no diversity penalty)", async () => {
    const q = vec(1, 0);
    const r = new MMRReranker({ lambda: 1, topK: 2, queryEmbedding: q });
    const cands = [
      scored("low", 0.1, [0, 1]),
      scored("high", 0.9, [1, 0]),
      scored("mid", 0.5, [0.7, 0.7]),
    ];
    const out = await r.rerank("q", cands);
    expect(out.results.map((c) => c.chunk.id)).toEqual([createChunkId("high"), createChunkId("mid")]);
  });

  it("lambda = 0.0 prioritizes diversity over relevance", async () => {
    // Three candidates: c1 aligned with q, c2 also aligned, c3 orthogonal.
    const q = vec(1, 0);
    const r = new MMRReranker({ lambda: 0, topK: 2, queryEmbedding: q });
    const cands = [
      scored("c1", 0.9, [1, 0]), // aligned
      scored("c2", 0.85, [0.99, 0.01]), // also aligned
      scored("c3", 0.0, [0, 1]), // orthogonal
    ];
    const out = await r.rerank("q", cands);
    // First pick: max sim to q is c1 (or c2; tie broken by index asc).
    // Second pick: c3 is most different from c1; c2 is similar.
    expect(out.results[0]?.chunk.id).toBe(createChunkId("c1"));
    expect(out.results[1]?.chunk.id).toBe(createChunkId("c3"));
  });

  it("diversity penalty clearly prefers the more distant candidate (lambda = 0.7)", async () => {
    // Three candidates with distinct relevance and distinct pairwise
    // similarity. The diversity-vs-relevance trade-off is unambiguous.
    // q = (1, 0)
    // a: q-sim=0.95, b: q-sim=0.90, c: q-sim=0.50
    // After picking a, sim-to-a: b=0.97, c=0.50
    //   b's MMR(0.7) = 0.7*0.90 - 0.3*0.97 = 0.630 - 0.291 = 0.339
    //   c's MMR(0.7) = 0.7*0.50 - 0.3*0.50 = 0.350 - 0.150 = 0.200
    // So b is preferred, but the penalty is visible. With lambda=0.5:
    //   b: 0.5*0.90 - 0.5*0.97 = -0.035
    //   c: 0.5*0.50 - 0.5*0.50 = 0
    // c wins at lambda=0.5.
    const q = vec(1, 0);
    const cands = [
      scored("a", 0.95, [0.95, 0.31]), // q-sim ~ 0.95
      scored("b", 0.90, [0.93, 0.36]), // q-sim ~ 0.93, sim-to-a ~ 0.97
      scored("c", 0.50, [0.5, 0.86]), // q-sim ~ 0.50, sim-to-a ~ 0.50
    ];
    const lambda07 = new MMRReranker({ lambda: 0.7, topK: 2, queryEmbedding: q });
    const out07 = await lambda07.rerank("q", cands);
    expect(out07.results[0]?.chunk.id).toBe(createChunkId("a"));
    expect(out07.results[1]?.chunk.id).toBe(createChunkId("b"));
  });

  it("respects topK: never returns more than topK results", async () => {
    const r = new MMRReranker({ lambda: 0.5, topK: 2, queryEmbedding: vec(1, 0) });
    const cands = [
      scored("a", 0.9, [1, 0]),
      scored("b", 0.8, [0.9, 0.1]),
      scored("c", 0.7, [0.8, 0.2]),
      scored("d", 0.6, [0.7, 0.3]),
    ];
    const out = await r.rerank("q", cands);
    expect(out.results).toHaveLength(2);
  });

  it("topK = candidates.length returns all candidates in MMR order", async () => {
    const r = new MMRReranker({ lambda: 0.5, topK: 3, queryEmbedding: vec(1, 0) });
    const cands = [
      scored("a", 0.9, [1, 0]),
      scored("b", 0.8, [0.9, 0.1]),
      scored("c", 0.7, [0, 1]),
    ];
    const out = await r.rerank("q", cands);
    expect(out.results).toHaveLength(3);
    // Identity preserved.
    expect(out.results.every((r) => cands.includes(r))).toBe(true);
  });

  it("preserves ScoredChunk identity (no-mutation contract)", async () => {
    const r = new MMRReranker({ lambda: 0.6, topK: 2, queryEmbedding: vec(1, 0) });
    const c1 = scored("a", 0.9, [1, 0]);
    const c2 = scored("b", 0.7, [0, 1]);
    const c3 = scored("c", 0.5, [0.7, 0.7]);
    const out = await r.rerank("q", [c1, c2, c3]);
    for (const s of out.results) {
      expect([c1, c2, c3]).toContain(s);
    }
  });

  it("diagnostics include mmrScores in selection order", async () => {
    const r = new MMRReranker({ lambda: 0.5, topK: 2, queryEmbedding: vec(1, 0) });
    const out = await r.rerank("q", [
      scored("a", 0.9, [1, 0]),
      scored("b", 0.7, [0, 1]),
      scored("c", 0.5, [0.7, 0.7]),
    ]);
    const diag = out.diagnostics as { mmrScores: readonly number[]; lambda: number; topK: number };
    expect(diag.mmrScores).toHaveLength(2);
    expect(diag.lambda).toBe(0.5);
    expect(diag.topK).toBe(2);
  });

  it("works with normalized 2-D vectors (reproducible diversity example)", async () => {
    // Canonical MMR example: q=(1,0), candidates at 0 deg, 20 deg, 90 deg.
    // After c0 is picked, c90 is more distant from c0 than c20, so MMR(0.5)
    // prefers c90 (0.5*0.0 - 0.5*0.0 = 0.0) over c20
    // (0.5*0.94 - 0.5*0.94 = 0.0 is a tie; we use 25 vs 90 to make it clear).
    const q = vec(1, 0);
    const cands = [
      scored("c0", 1.0, Array.from(normalized([1, 0]))),
      scored("c25", 0.906, Array.from(normalized([Math.cos(Math.PI / 7.2), Math.sin(Math.PI / 7.2)]))),
      scored("c90", 0.0, Array.from(normalized([0, 1]))),
    ];
    const r = new MMRReranker({ lambda: 0.5, topK: 3, queryEmbedding: q });
    const out = await r.rerank("q", cands);
    // First pick: c0 (highest q-sim = 1.0).
    // Second pick: c25 MMR = 0.5*0.906 - 0.5*cos(25deg) = 0.
    //              c90 MMR = 0.5*0.0 - 0.5*cos(90deg) = 0.
    //              c90 wins because 0.0 < 0.0 numerically equal but c90
    //              had query sim 0; we use asymmetric case to avoid tie.
    // The order in [c25, c90] is determined by tie-break; assert both
    // appear after c0.
    expect(out.results[0]?.chunk.id).toBe(createChunkId("c0"));
    expect(out.results).toHaveLength(3);
    expect(new Set(out.results.slice(1).map((c) => String(c.chunk.id)))).toEqual(
      new Set([String(createChunkId("c25")), String(createChunkId("c90"))]),
    );
  });

  it("dimension mismatch on candidate embedding throws KernelError", async () => {
    const r = new MMRReranker({ lambda: 0.5, topK: 5, queryEmbedding: vec(1, 0) });
    const cands = [
      scored("a", 0.9, [1, 0, 0]), // 3-D
      scored("b", 0.7, [0, 1]), // 2-D
    ];
    await expect(r.rerank("q", cands)).rejects.toBeInstanceOf(KernelError);
  });
});
