import { createChunkId, createDocumentId, type TextSpan } from "@lyra-sdk/kernel";
import { BM25Index } from "@lyra-sdk/index";
import { InMemoryChunkRepository, InMemoryDocumentRepository, type Chunk } from "@lyra-sdk/storage";
import { describe, expect, it } from "vitest";
import { BM25Retriever } from "../../src/lexical/bm25-retriever.js";

const docId = createDocumentId("doc-1");
const span = (start: number, end: number): TextSpan => ({ sourceId: docId, start, end });
const chunk = (suffix: string, start: number, end: number): Chunk => ({
  id: createChunkId(`c-${suffix}`),
  documentId: docId,
  span: span(start, end),
  metadata: {},
});

describe("BM25Retriever", () => {
  it("returns empty for an empty index", async () => {
    const r = new BM25Retriever({
      index: new BM25Index(),
      chunks: new InMemoryChunkRepository(),
      documents: new InMemoryDocumentRepository(),
    });
    const out = await r.retrieve("anything", 5);
    expect(out.results).toEqual([]);
    expect(out.query).toBe("anything");
  });

  it("returns the top-k chunks by BM25 score", async () => {
    const cidA = createChunkId("a");
    const cidB = createChunkId("b");
    const cidC = createChunkId("c");
    const idx = new BM25Index();
    idx.add(cidA, "javascript async await promises");
    idx.add(cidB, "chocolate cake recipe");
    idx.add(cidC, "javascript promises and async functions");
    const chunks = new InMemoryChunkRepository();
    await chunks.save([
      { id: cidA, documentId: docId, span: span(0, 33), metadata: {} },
      { id: cidB, documentId: docId, span: span(33, 54), metadata: {} },
      { id: cidC, documentId: docId, span: span(54, 92), metadata: {} },
    ]);
    const r = new BM25Retriever({
      index: idx,
      chunks,
      documents: new InMemoryDocumentRepository(),
    });
    const out = await r.retrieve("javascript async", 3);
    expect(out.results.length).toBe(2);
    const ids = out.results.map((s) => s.chunk.id);
    expect(ids).not.toContain(cidB);
  });

  it("resolves chunk ids via the chunk repository", async () => {
    const cid = createChunkId("a");
    const idx = new BM25Index();
    idx.add(cid, "the quick brown fox");
    const chunks = new InMemoryChunkRepository();
    await chunks.save([chunk("a", 0, 19)]);
    // Patch the saved chunk's id to match the indexed id.
    await chunks.delete(chunk("a", 0, 19).id);
    await chunks.save([{ id: cid, documentId: docId, span: span(0, 19), metadata: {} }]);
    const r = new BM25Retriever({
      index: idx,
      chunks,
      documents: new InMemoryDocumentRepository(),
    });
    const out = await r.retrieve("fox", 5);
    expect(out.results.length).toBe(1);
    expect(out.results[0]?.chunk.documentId).toBe("doc-1");
  });

  it("drops candidates whose chunk cannot be resolved", async () => {
    const cidA = createChunkId("a");
    const cidMissing = createChunkId("missing");
    const idx = new BM25Index();
    idx.add(cidA, "fox");
    idx.add(cidMissing, "fox");
    const chunks = new InMemoryChunkRepository();
    await chunks.save([{ id: cidA, documentId: docId, span: span(0, 3), metadata: {} }]);
    const r = new BM25Retriever({
      index: idx,
      chunks,
      documents: new InMemoryDocumentRepository(),
    });
    const out = await r.retrieve("fox", 5);
    expect(out.results.length).toBe(1);
    expect(out.results[0]?.chunk.id).toBe(cidA);
  });

  it("respects k", async () => {
    const idx = new BM25Index();
    const chunks = new InMemoryChunkRepository();
    const ids: ReturnType<typeof createChunkId>[] = [];
    for (let i = 0; i < 10; i++) {
      const cid = createChunkId(`c${i}`);
      ids.push(cid);
      idx.add(cid, `cat document ${i}`);
      await chunks.save([{ id: cid, documentId: docId, span: span(i * 10, i * 10 + 10), metadata: {} }]);
    }
    const r = new BM25Retriever({
      index: idx,
      chunks,
      documents: new InMemoryDocumentRepository(),
    });
    const out = await r.retrieve("cat", 3);
    expect(out.results.length).toBe(3);
  });

  it("records durationMs", async () => {
    const r = new BM25Retriever({
      index: new BM25Index(),
      chunks: new InMemoryChunkRepository(),
      documents: new InMemoryDocumentRepository(),
    });
    const out = await r.retrieve("anything", 5);
    expect(typeof out.durationMs).toBe("number");
    expect(out.durationMs).toBeGreaterThanOrEqual(0);
  });
});
