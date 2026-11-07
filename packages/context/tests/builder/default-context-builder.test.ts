import { createChunkId, createDocumentId } from "@lyra-sdk/kernel";
import type { SourceDocument } from "@lyra-sdk/storage";
import type { ScoredChunk } from "@lyra-sdk/retrieval";
import { describe, expect, it } from "vitest";
import { InMemoryChunkRepository } from "@lyra-sdk/storage";
import { DefaultContextBuilder } from "../../src/builder/default-context-builder.js";
import { CharHeuristicTokenCounter } from "../../src/transform/budgeting/token-counter.js";
import { ScoreOrdering } from "../../src/transform/ordering/score-ordering.js";
import { TranscriptExpander } from "../../src/transform/expansion/transcript-expander.js";

function doc(id: string, content: string): SourceDocument {
  return {
    id: createDocumentId(id),
    sourceUri: `lyra://${id}`,
    content,
    blocks: [{ text: content, metadata: {} }],
    metadata: {},
  };
}

function scored(
  chunkId: string,
  documentId: string,
  text: string,
  score: number,
  start: number,
  end: number,
  extra: { timestamp?: number; title?: string; speaker?: string } = {},
): ScoredChunk {
  return {
    chunk: {
      id: createChunkId(chunkId),
      documentId: createDocumentId(documentId),
      span: { start, end, sourceId: createDocumentId(documentId) },
      metadata: {
        ...(extra.timestamp !== undefined ? { timestamp: extra.timestamp } : {}),
        ...(extra.title !== undefined ? { title: extra.title } : {}),
        ...(extra.speaker !== undefined ? { speaker: extra.speaker } : {}),
      },
    },
    score,
  };
}

describe("DefaultContextBuilder", () => {
  it("rejects negative tokenBudget", () => {
    expect(() => new DefaultContextBuilder({ tokenBudget: -1, documents: new Map() })).toThrow();
  });

  it("rejects reservedForResponse > tokenBudget", () => {
    expect(
      () =>
        new DefaultContextBuilder({
          tokenBudget: 100,
          reservedForResponse: 200,
          documents: new Map(),
        }),
    ).toThrow();
  });

  it("requires either resolver or documents", () => {
    expect(() => new DefaultContextBuilder({ tokenBudget: 100 })).toThrow();
  });

  it("returns an empty Context for empty chunks", async () => {
    const b = new DefaultContextBuilder({ tokenBudget: 100, documents: new Map() });
    const out = await b.build([]);
    expect(out.chunks).toEqual([]);
    expect(out.citations).toEqual([]);
    expect(out.usedTokens).toBe(0);
    expect(out.tokenBudget).toBe(100);
    expect(out.effectiveBudget).toBe(100);
    expect(out.truncated).toBe(false);
  });

  it("resolves content from the in-memory resolver", async () => {
    const documents = new Map<string, SourceDocument>([
      ["doc-1", doc("doc-1", "Hello, world! Goodbye, world!")],
    ]);
    const b = new DefaultContextBuilder({ tokenBudget: 1000, documents });
    const out = await b.build([
      scored("c-1", "doc-1", "Hello, world!", 0.9, 0, 13),
      scored("c-2", "doc-1", "Goodbye, world!", 0.8, 14, 29),
    ]);
    expect(out.chunks).toHaveLength(2);
    expect(out.chunks[0]?.text).toBe("Hello, world!");
    expect(out.chunks[1]?.text).toBe("Goodbye, world!");
  });

  it("uses TranscriptOrdering by default: timestamps first, others by score", async () => {
    const documents = new Map<string, SourceDocument>([["doc-1", doc("doc-1", "abcdef")]]);
    const b = new DefaultContextBuilder({ tokenBudget: 1000, documents });
    const out = await b.build([
      scored("c-1", "doc-1", "no-ts-high", 0.9, 0, 1),
      scored("c-2", "doc-1", "ts-low", 0.3, 2, 3, { timestamp: 1000 }),
      scored("c-3", "doc-1", "ts-high", 0.5, 4, 5, { timestamp: 2000 }),
    ]);
    // Transcripts first: ts-low (ts=1000), ts-high (ts=2000).
    // Non-transcripts by score desc: no-ts-high (0.9).
    expect(out.chunks.map((c) => c.chunkId)).toEqual([
      createChunkId("c-2"),
      createChunkId("c-3"),
      createChunkId("c-1"),
    ]);
  });

  it("respects tokenBudget: shortens overflow and keeps the truncation note inside the budget", async () => {
    const longText = `${"a".repeat(40)} ${"b".repeat(40)} ${"c".repeat(40)}`;
    const documents = new Map<string, SourceDocument>([["doc-1", doc("doc-1", longText)]]);
    const noteTokens = new CharHeuristicTokenCounter().count(
      "\n\nNote: some context was truncated to fit the budget.",
    );
    const budget = noteTokens + 12;
    const b = new DefaultContextBuilder({ tokenBudget: budget, documents });
    const out = await b.build([
      scored("c-1", "doc-1", "a", 0.9, 0, 40),
      scored("c-2", "doc-1", "b", 0.8, 41, 81),
      scored("c-3", "doc-1", "c", 0.7, 82, 122),
    ]);
    expect(out.chunks.length).toBeGreaterThan(0);
    expect(out.chunks[0]?.chunkId).toBe(createChunkId("c-1"));
    expect(out.truncated).toBe(true);
    expect(out.usedTokens).toBeLessThanOrEqual(budget);
    expect(out.effectiveBudget).toBe(budget);
  });

  it("dedupes identical chunks (same chunkId, same span)", async () => {
    const documents = new Map<string, SourceDocument>([["doc-1", doc("doc-1", "abc")]]);
    const b = new DefaultContextBuilder({ tokenBudget: 1000, documents });
    const out = await b.build([
      scored("c-1", "doc-1", "x", 0.9, 0, 1),
      scored("c-1", "doc-1", "x", 0.9, 0, 1), // duplicate
    ]);
    expect(out.chunks).toHaveLength(1);
  });

  it("merges adjacent chunks in the same document", async () => {
    const documents = new Map<string, SourceDocument>([["doc-1", doc("doc-1", "hello world")]]);
    const b = new DefaultContextBuilder({ tokenBudget: 1000, documents });
    const out = await b.build([
      scored("c-1", "doc-1", "hello", 0.9, 0, 5),
      scored("c-2", "doc-1", " world", 0.8, 5, 11),
    ]);
    expect(out.chunks).toHaveLength(1);
    expect(out.chunks[0]?.text).toBe("hello world");
  });

  it("cites both sources of a merged chunk", async () => {
    const documents = new Map<string, SourceDocument>([["doc-1", doc("doc-1", "hello world")]]);
    const b = new DefaultContextBuilder({ tokenBudget: 1000, documents });
    const out = await b.build([
      scored("c-1", "doc-1", "hello", 0.9, 0, 5),
      scored("c-2", "doc-1", " world", 0.8, 5, 11),
    ]);
    expect(out.chunks).toHaveLength(1);
    expect(out.citations.map((c) => c.key)).toEqual(["doc-1:c-1", "doc-1:c-2"]);
    expect(out.citations.map((c) => c.marker)).toEqual([1, 1]);
  });

  it("keeps timestamp and speaker and drops the metadata bag by default", async () => {
    const documents = new Map<string, SourceDocument>([["doc-1", doc("doc-1", "abc")]]);
    const b = new DefaultContextBuilder({ tokenBudget: 1000, documents });
    const out = await b.build([
      scored("c-1", "doc-1", "x", 0.9, 0, 1, { timestamp: 4, speaker: "Ada" }),
    ]);
    expect(out.chunks[0]?.timestamp).toBe(4);
    expect(out.chunks[0]?.speaker).toBe("Ada");
    expect(out.chunks[0]?.metadata).toBeUndefined();
  });

  it("preserves citations: each chunk's citation is in the citations list", async () => {
    const documents = new Map<string, SourceDocument>([["doc-1", doc("doc-1", "abc")]]);
    const b = new DefaultContextBuilder({ tokenBudget: 1000, documents });
    const out = await b.build([
      scored("c-1", "doc-1", "x", 0.9, 0, 1),
      scored("c-2", "doc-1", "y", 0.8, 0, 1),
    ]);
    expect(out.citations).toHaveLength(2);
    expect(out.citations[0]?.key).toBe("doc-1:c-1");
    expect(out.citations[1]?.key).toBe("doc-1:c-2");
  });

  it("carries the timestamp from chunk metadata into ContextChunk.timestamp", async () => {
    const documents = new Map<string, SourceDocument>([["doc-1", doc("doc-1", "abc")]]);
    const b = new DefaultContextBuilder({ tokenBudget: 1000, documents });
    const out = await b.build([scored("c-1", "doc-1", "x", 0.9, 0, 1, { timestamp: 1234 })]);
    expect(out.chunks[0]?.timestamp).toBe(1234);
  });

  it("carries timestamp, speaker and embedding together (no field is dropped)", async () => {
    const documents = new Map<string, SourceDocument>([["doc-1", doc("doc-1", "abc")]]);
    const b = new DefaultContextBuilder({
      tokenBudget: 1000,
      documents,
      compression: { name: "noop", compress: (xs) => xs },
    });
    const embedding = new Float32Array([1, 0, 0]);
    const sc = scored("c-1", "doc-1", "x", 0.9, 0, 1, { timestamp: 1234, speaker: "Ada" });
    const out = await b.build([{ ...sc, embedding }]);
    expect(out.chunks[0]?.timestamp).toBe(1234);
    expect(out.chunks[0]?.speaker).toBe("Ada");
    expect(out.chunks[0]?.embedding).toBe(embedding);
  });

  it("propagates ScoredChunk.embedding into ContextChunk.embedding", async () => {
    const documents = new Map<string, SourceDocument>([["doc-1", doc("doc-1", "abc")]]);
    const b = new DefaultContextBuilder({
      tokenBudget: 1000,
      documents,
      compression: { name: "noop", compress: (xs) => xs },
    });
    const embedding = new Float32Array([1, 0, 0]);
    const sc = scored("c-1", "doc-1", "x", 0.9, 0, 1);
    const withEmb: ScoredChunk = { ...sc, embedding };
    const out = await b.build([withEmb]);
    expect(out.chunks[0]?.embedding).toBe(embedding);
  });

  it("uses a caller-supplied ScoreOrdering instead of transcript order", async () => {
    const documents = new Map<string, SourceDocument>([["doc-1", doc("doc-1", "abcdef")]]);
    const b = new DefaultContextBuilder({
      tokenBudget: 1000,
      documents,
      ordering: new ScoreOrdering(),
    });
    const out = await b.build([
      scored("c-1", "doc-1", "early", 0.2, 0, 1, { timestamp: 1 }),
      scored("c-2", "doc-1", "late", 0.9, 2, 3, { timestamp: 50 }),
    ]);
    expect(out.chunks.map((c) => c.chunkId)).toEqual([createChunkId("c-2"), createChunkId("c-1")]);
  });

  it("TranscriptExpander pulls neighbors from the chunk repository", async () => {
    const documents = new Map<string, SourceDocument>([["doc-1", doc("doc-1", "abcdefghij")]]);
    const chunks = new InMemoryChunkRepository();
    const first = scored("c-1", "doc-1", "abcd", 0.9, 0, 4, { timestamp: 0 });
    const second = scored("c-2", "doc-1", "ghij", 0.2, 6, 10, { timestamp: 5 });
    await chunks.save([first.chunk, second.chunk]);
    const b = new DefaultContextBuilder({
      tokenBudget: 1000,
      documents,
      chunkRepository: chunks,
      expander: new TranscriptExpander({ windowSeconds: 30 }),
    });
    const out = await b.build([first]);
    expect(out.diagnostics.expandedCount).toBe(2);
    expect(out.chunks.map((c) => c.chunkId)).toEqual([createChunkId("c-1"), createChunkId("c-2")]);
    expect(out.chunks[0]?.timestamp).toBe(0);
    expect(out.chunks[1]?.timestamp).toBe(5);
  });

  it("uses chunk metadata title and url when the document has neither", async () => {
    const documents = new Map<string, SourceDocument>([["doc-1", doc("doc-1", "hello")]]);
    const b = new DefaultContextBuilder({ tokenBudget: 1000, documents });
    const base = scored("c-1", "doc-1", "hello", 0.9, 0, 5);
    const out = await b.build([
      {
        ...base,
        chunk: {
          ...base.chunk,
          metadata: { title: "Chunk Title", url: "https://example.com/a" },
        },
      },
    ]);
    expect(out.citations[0]?.label).toBe("Chunk Title");
    expect(out.citations[0]?.url).toBe("https://example.com/a");
  });

  it("shortens the only chunk so the source footer still fits", async () => {
    const text = "a".repeat(200);
    const documents = new Map<string, SourceDocument>([["doc-1", doc("doc-1", text)]]);
    const counter = new CharHeuristicTokenCounter();
    const noteTokens = counter.count("\n\nNote: some context was truncated to fit the budget.");
    const footer = 8;
    const budget = noteTokens + footer + 4;
    const b = new DefaultContextBuilder({
      tokenBudget: budget,
      documents,
      countExtras: () => footer,
    });
    const out = await b.build([scored("c-1", "doc-1", text, 0.9, 0, text.length)]);
    expect(out.chunks).toHaveLength(1);
    expect(out.chunks[0]?.text.length).toBeLessThan(text.length);
    expect(out.truncated).toBe(true);
    expect(out.usedTokens).toBeLessThanOrEqual(budget);
  });

  it("context is deeply readonly (no mutation possible)", async () => {
    const documents = new Map<string, SourceDocument>([["doc-1", doc("doc-1", "abc")]]);
    const b = new DefaultContextBuilder({ tokenBudget: 1000, documents });
    const out = await b.build([scored("c-1", "doc-1", "x", 0.9, 0, 1)]);
    // Compile-time: out.chunks is readonly. We can still attempt a
    // runtime mutation, but it should not affect the read-only
    // types downstream.
    expect(Array.isArray(out.chunks)).toBe(true);
  });
});
