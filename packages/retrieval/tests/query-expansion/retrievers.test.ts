import { createChunkId, createDocumentId } from "@lyra-sdk/kernel";
import type { Chunk, ScoredChunk } from "@lyra-sdk/storage";
import type { RetrievalResult, Retriever } from "../../src/contracts/retriever.js";
import { describe, expect, it } from "vitest";
import { IdentityExpander } from "../../src/query-expansion/expanders/identity-expander.js";
import { SynonymExpander } from "../../src/query-expansion/expanders/synonym-expander.js";
import { MultiQueryRetriever } from "../../src/query-expansion/multi-query-retriever.js";
import { HyDERetriever } from "../../src/query-expansion/hyde-retriever.js";
import { RewriteRetriever } from "../../src/query-expansion/rewrite-retriever.js";
import { DecompositionRetriever } from "../../src/query-expansion/decomposition-retriever.js";

const docId = createDocumentId("d-1");
const chunk = (id: string): Chunk => ({
  id: createChunkId(id),
  documentId: docId,
  span: { sourceId: docId, start: 0, end: 10 },
  metadata: {},
});
const sc = (id: string, score = 1): ScoredChunk => ({ chunk: chunk(id), score });

class StubRetriever implements Retriever {
  public calls: string[] = [];
  constructor(private readonly perCallResult: (query: string, k: number) => RetrievalResult) {}
  async retrieve(query: string, k: number): Promise<RetrievalResult> {
    this.calls.push(query);
    return this.perCallResult(query, k);
  }
}

describe("MultiQueryRetriever", () => {
  it("calls the inner retriever once per expanded query", async () => {
    const inner = new StubRetriever(
      (q, k) => ({ query: q, results: [sc("a", 1)], durationMs: 0 }),
    );
    const r = new MultiQueryRetriever({
      retriever: inner,
      expander: new SynonymExpander(),
    });
    await r.retrieve("how to make a fast website", 5);
    // Original + 1 synonym alternative for 'fast'.
    expect(inner.calls.length).toBeGreaterThanOrEqual(2);
    expect(inner.calls[0]).toBe("how to make a fast website");
  });

  it("echoes the original query in the result", async () => {
    const inner = new StubRetriever(
      (q, k) => ({ query: q, results: [sc("a")], durationMs: 0 }),
    );
    const r = new MultiQueryRetriever({
      retriever: inner,
      expander: new IdentityExpander(),
    });
    const out = await r.retrieve("the user's question", 5);
    expect(out.query).toBe("the user's question");
  });

  it("respects k", async () => {
    const inner = new StubRetriever(
      (q, k) => ({ query: q, results: [sc("a"), sc("b"), sc("c")], durationMs: 0 }),
    );
    const r = new MultiQueryRetriever({
      retriever: inner,
      expander: new IdentityExpander(),
    });
    const out = await r.retrieve("q", 2);
    expect(out.results.length).toBe(2);
  });

  it("a chunk present in multiple expanded queries outranks a chunk in one", async () => {
    const inner = new StubRetriever((q, k) => {
      if (q === "q") return { query: q, results: [sc("only"), sc("both")], durationMs: 0 };
      if (q === "q2") return { query: q, results: [sc("both")], durationMs: 0 };
      return { query: q, results: [], durationMs: 0 };
    });
    const r = new MultiQueryRetriever({
      retriever: inner,
      expander: new IdentityExpander(), // identity -> 1 query. stub with custom expander below.
    });
    // For this test we need a 2-query expander.
    const twoQuery = { expand: async () => ["q", "q2"] };
    const r2 = new MultiQueryRetriever({
      retriever: inner,
      expander: twoQuery as never,
    });
    const out = await r2.retrieve("anything", 5);
    expect(out.results[0]?.chunk.id).toBe("both");
  });
});

describe("HyDERetriever", () => {
  it("rewrites the query with a template and delegates", async () => {
    const inner = new StubRetriever(
      (q, k) => ({ query: q, results: [sc("a")], durationMs: 0 }),
    );
    const r = new HyDERetriever({ retriever: inner, template: "Doc: " });
    await r.retrieve("cats", 5);
    expect(inner.calls[0]).toBe("Doc: cats");
  });

  it("uses the default template when none is supplied", async () => {
    const inner = new StubRetriever(
      (q, k) => ({ query: q, results: [sc("a")], durationMs: 0 }),
    );
    const r = new HyDERetriever({ retriever: inner });
    await r.retrieve("cats", 5);
    expect(inner.calls[0]).toBe("This document is about: cats");
  });

  it("echoes the original query in the result", async () => {
    const inner = new StubRetriever(
      (q, k) => ({ query: q, results: [], durationMs: 0 }),
    );
    const r = new HyDERetriever({ retriever: inner });
    const out = await r.retrieve("original", 5);
    expect(out.query).toBe("original");
  });
});

describe("RewriteRetriever", () => {
  it("strips default filler words", async () => {
    const inner = new StubRetriever(
      (q, k) => ({ query: q, results: [sc("a")], durationMs: 0 }),
    );
    const r = new RewriteRetriever({ retriever: inner });
    await r.retrieve("um how to make uh a website", 5);
    expect(inner.calls[0]).toBe("how to make a website");
  });

  it("respects a custom filler list", async () => {
    const inner = new StubRetriever(
      (q, k) => ({ query: q, results: [], durationMs: 0 }),
    );
    const r = new RewriteRetriever({ retriever: inner, fillerWords: ["yo"] });
    await r.retrieve("yo cats yo", 5);
    expect(inner.calls[0]).toBe("cats");
  });

  it("preserves the original query in the result", async () => {
    const inner = new StubRetriever(
      (q, k) => ({ query: q, results: [], durationMs: 0 }),
    );
    const r = new RewriteRetriever({ retriever: inner });
    const out = await r.retrieve("um cats", 5);
    expect(out.query).toBe("um cats");
  });
});

describe("DecompositionRetriever", () => {
  it("decomposes via the expander, runs each, and fuses", async () => {
    const inner = new StubRetriever(
      (q, k) => ({ query: q, results: q === "a" ? [sc("hitA")] : [sc("hitB")], durationMs: 0 }),
    );
    const expander = {
      expand: async (q: string) => ["a", "b"],
    };
    const r = new DecompositionRetriever({
      retriever: inner,
      expander: expander as never,
    });
    const out = await r.retrieve("anything", 5);
    expect(inner.calls).toEqual(["a", "b"]);
    expect(out.results.length).toBe(2);
  });

  it("echoes the original query in the result", async () => {
    const inner = new StubRetriever(
      (q, k) => ({ query: q, results: [], durationMs: 0 }),
    );
    const r = new DecompositionRetriever({
      retriever: inner,
      expander: new IdentityExpander(),
    });
    const out = await r.retrieve("the compound query", 5);
    expect(out.query).toBe("the compound query");
  });
});
