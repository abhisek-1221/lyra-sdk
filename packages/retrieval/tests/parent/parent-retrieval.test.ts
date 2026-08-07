import { createChunkId, createDocumentId, type TextSpan } from "@lyra-sdk/kernel";
import type { Chunk, ChunkId, ScoredChunk, SourceDocument } from "@lyra-sdk/storage";
import { InMemoryDocumentRepository } from "@lyra-sdk/storage";
import type { RetrievalResult, Retriever } from "../../src/contracts/retriever.js";
import { describe, expect, it } from "vitest";
import { DocumentSiblingGrouping } from "../../src/parent/chunk-grouping.js";
import { LongestSpanParentResolver } from "../../src/parent/parent-resolver.js";
import { ParentDocumentRetriever } from "../../src/parent/parent-document-retriever.js";

const docId = createDocumentId("doc-1");
const span = (start: number, end: number): TextSpan => ({ sourceId: docId, start, end });
const chunk = (id: string, start: number, end: number): Chunk => ({
  id: createChunkId(id),
  documentId: docId,
  span: span(start, end),
  metadata: {},
});

class StubRetriever implements Retriever {
  public calls = 0;
  constructor(private readonly result: RetrievalResult) {}
  async retrieve(_q: string, _k: number): Promise<RetrievalResult> {
    this.calls++;
    return this.result;
  }
}

const mkResult = (ids: string[], score = 1): RetrievalResult => ({
  query: "q",
  results: ids.map<ScoredChunk>((id) => ({ chunk: chunk(id, 0, 5), score })),
  durationMs: 0,
});

describe("DocumentSiblingGrouping", () => {
  it("returns all sibling blocks in the same document except self", async () => {
    const doc: SourceDocument = {
      id: docId,
      sourceUri: "x",
      content: "line1\nline2\nline3",
      blocks: [
        { text: "line1", metadata: { chunkId: "a" } },
        { text: "line2", metadata: { chunkId: "b" } },
        { text: "line3", metadata: { chunkId: "c" } },
      ],
      metadata: {},
    };
    const repo = new InMemoryDocumentRepository();
    await repo.save([doc]);
    const g = new DocumentSiblingGrouping();
    const siblings = await g.siblings(chunk("b", 6, 12), repo);
    expect(siblings.length).toBe(2);
    const ids = siblings.map((s) => s.id as string).sort();
    expect(ids).toEqual(["a", "c"]);
  });

  it("returns empty for a missing document", async () => {
    const g = new DocumentSiblingGrouping();
    const siblings = await g.siblings(chunk("a", 0, 5), new InMemoryDocumentRepository());
    expect(siblings).toEqual([]);
  });
});

describe("LongestSpanParentResolver", () => {
  const r = new LongestSpanParentResolver();

  it("returns the original chunk when the group is empty", () => {
    expect(r.resolve(chunk("a", 0, 5), [])).toEqual(chunk("a", 0, 5));
  });

  it("picks the chunk with the largest span", () => {
    const out = r.resolve(chunk("a", 0, 5), [chunk("b", 0, 20), chunk("c", 0, 8)]);
    expect(out.id).toBe("b");
  });
});

describe("ParentDocumentRetriever", () => {
  it("runs the child retriever and expands to parents", async () => {
    const doc: SourceDocument = {
      id: docId,
      sourceUri: "x",
      content: "abc",
      blocks: [
        { text: "a", metadata: { chunkId: "child" } },
        { text: "b", metadata: { chunkId: "other" } },
        { text: "c", metadata: { chunkId: "other2" } },
      ],
      metadata: {},
    };
    const repo = new InMemoryDocumentRepository();
    await repo.save([doc]);
    const child = new StubRetriever(mkResult(["child"]));
    const r = new ParentDocumentRetriever({
      retriever: child,
      documents: repo,
    });
    const out = await r.retrieve("q", 5);
    // The child chunk has 2 siblings. With DocumentSiblingGrouping
    // and the smallest-spans (1 char each), the original child
    // is the only span with length > 0; the longest-spans resolver
    // picks one of the siblings (they're all length 1).
    expect(out.results.length).toBe(1);
  });

  it("deduplicates parents", async () => {
    // Two child hits in the same document; both expand to the same
    // parent.
    const doc: SourceDocument = {
      id: docId,
      sourceUri: "x",
      content: "abcdef",
      blocks: [
        { text: "abc", metadata: { chunkId: "a" } },
        { text: "def", metadata: { chunkId: "b" } },
      ],
      metadata: {},
    };
    const repo = new InMemoryDocumentRepository();
    await repo.save([doc]);
    const child = new StubRetriever({
      query: "q",
      results: [
        { chunk: chunk("a", 0, 3), score: 1.0 },
        { chunk: chunk("b", 3, 6), score: 0.8 },
      ],
      durationMs: 0,
    });
    const r = new ParentDocumentRetriever({
      retriever: child,
      documents: repo,
      parentResolver: new LongestSpanParentResolver(),
    });
    const out = await r.retrieve("q", 5);
    // Both 'a' and 'b' are siblings of each other. The
    // longest-span resolver picks the larger (they're equal at
    // 3 chars, but ties go to the first). One parent is emitted.
    expect(out.results.length).toBe(1);
  });

  it("respects k", async () => {
    const repo = new InMemoryDocumentRepository();
    await repo.save([
      {
        id: docId,
        sourceUri: "x",
        content: "abc",
        blocks: [{ text: "a", metadata: { chunkId: "child" } }],
        metadata: {},
      },
    ]);
    const child = new StubRetriever({
      query: "q",
      results: [
        { chunk: chunk("child", 0, 1), score: 1.0 },
        { chunk: chunk("orphan", 0, 1), score: 0.9 },
      ],
      durationMs: 0,
    });
    const r = new ParentDocumentRetriever({
      retriever: child,
      documents: repo,
    });
    const out = await r.retrieve("q", 1);
    expect(out.results.length).toBe(1);
  });

  it("echoes the original query in the result", async () => {
    const child = new StubRetriever(mkResult([]));
    const r = new ParentDocumentRetriever({
      retriever: child,
      documents: new InMemoryDocumentRepository(),
    });
    const out = await r.retrieve("the user's question", 5);
    expect(out.query).toBe("the user's question");
  });
});
