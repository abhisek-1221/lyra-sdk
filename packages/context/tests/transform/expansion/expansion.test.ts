import { createChunkId, createDocumentId, type DocumentId } from "@lyra-sdk/kernel";
import type { Chunk, ChunkRepository } from "@lyra-sdk/storage";
import type { ContextChunk } from "../../../src/types/index.js";
import { makeCitation } from "../../../src/citations/index.js";
import { IdentityExpander } from "../../../src/transform/expansion/identity-expander.js";
import { TranscriptExpander } from "../../../src/transform/expansion/transcript-expander.js";
import { describe, expect, it } from "vitest";

function contextChunk(id: string, ts: number | undefined, doc = "doc-1", text = `text-${id}`): ContextChunk {
  const docId = createDocumentId(doc);
  return {
    chunkId: createChunkId(id),
    documentId: docId,
    text,
    score: 0.5,
    span: { start: 0, end: text.length, sourceId: docId },
    citation: makeCitation({ documentId: docId, chunkId: createChunkId(id) }),
    ...(ts !== undefined ? { timestamp: ts } : {}),
  };
}

function stored(id: string, ts: number | undefined, doc = "doc-1", text = `text-${id}`): Chunk {
  const docId = createDocumentId(doc);
  return {
    id: createChunkId(id),
    documentId: docId,
    span: { start: 0, end: text.length, sourceId: docId },
    metadata: ts === undefined ? {} : { timestamp: ts },
  };
}

function repo(chunks: readonly Chunk[]): ChunkRepository {
  return {
    async save() {},
    async get() {
      return null;
    },
    async getMany() {
      return [];
    },
    async listByDocument(documentId: DocumentId) {
      return chunks.filter((chunk) => chunk.documentId === documentId);
    },
    async delete() {},
    size() {
      return chunks.length;
    },
    dispose() {},
  };
}

describe("IdentityExpander", () => {
  it("returns the input unchanged", async () => {
    const r = new IdentityExpander();
    const input = [contextChunk("a", 1), contextChunk("b", 2)];
    const out = await r.expand(input);
    expect(out).toBe(input);
  });
});

describe("TranscriptExpander", () => {
  it("rejects a negative window", () => {
    expect(() => new TranscriptExpander({ windowSeconds: -1 })).toThrow();
  });

  it("rejects negative maxAddedChars", () => {
    expect(() => new TranscriptExpander({ maxAddedChars: -1 })).toThrow();
  });

  it("returns the input unchanged when no chunk repository is configured", async () => {
    const r = new TranscriptExpander();
    const input = [contextChunk("a", 0), contextChunk("b", 5)];
    const out = await r.expand(input);
    expect(out).toEqual(input);
  });

  it("pulls in stored neighbors within the window and discounts their score", async () => {
    const corpus = [
      stored("a", 0),
      stored("b", 5),
      stored("c", 10),
      stored("d", 100),
    ];
    const r = new TranscriptExpander({ windowSeconds: 30 });
    const out = await r.expand([contextChunk("a", 0)], {
      chunkRepository: repo(corpus),
      toContextChunk: async (chunk, score) => {
        const timestamp = chunk.metadata["timestamp"];
        const id = String(chunk.id);
        return {
          ...contextChunk(id, typeof timestamp === "number" ? timestamp : undefined),
          chunkId: chunk.id,
          score,
        };
      },
    });
    const ids = out.map((c) => String(c.chunkId));
    expect(ids).toContain(String(createChunkId("a")));
    expect(ids).toContain(String(createChunkId("b")));
    expect(ids).toContain(String(createChunkId("c")));
    expect(ids).not.toContain(String(createChunkId("d")));
    const neighbor = out.find((c) => String(c.chunkId) === String(createChunkId("b")));
    expect(neighbor?.score).toBe(0.25);
  });

  it("pulls in neighbors in both directions", async () => {
    const corpus = [stored("a", 0), stored("b", 1)];
    const r = new TranscriptExpander({ windowSeconds: 30 });
    const out = await r.expand([contextChunk("a", 0)], {
      chunkRepository: repo(corpus),
      toContextChunk: async (chunk, score) => ({
        ...contextChunk("x", 0),
        chunkId: chunk.id,
        score,
      }),
    });
    expect(out).toHaveLength(2);
  });

  it("dedupes when multiple selected chunks ask for the same neighbor", async () => {
    const corpus = [stored("a", 0), stored("b", 1), stored("c", 2)];
    const r = new TranscriptExpander({ windowSeconds: 30 });
    const out = await r.expand([contextChunk("a", 0), contextChunk("b", 1)], {
      chunkRepository: repo(corpus),
      toContextChunk: async (chunk) => ({ ...contextChunk("n", 0), chunkId: chunk.id }),
    });
    const ids = out.map((c) => String(c.chunkId));
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("respects maxAddedChars and keeps scanning", async () => {
    const big = stored("big", 1, "doc-1", "x".repeat(50));
    const corpus = [stored("a", 0), big, stored("c", 2, "doc-1", "short")];
    const r = new TranscriptExpander({ windowSeconds: 30, maxAddedChars: 10 });
    const out = await r.expand([contextChunk("a", 0, "doc-1", "seed")], {
      chunkRepository: repo(corpus),
      toContextChunk: async (chunk, score) => {
        const text = chunk.id === big.id ? "x".repeat(50) : "short";
        return { ...contextChunk("n", 1, "doc-1", text), chunkId: chunk.id, text, score };
      },
    });
    const ids = out.map((c) => String(c.chunkId));
    expect(ids).not.toContain(String(big.id));
    expect(ids).toContain(String(createChunkId("c")));
  });

  it("does not pull in chunks from other documents", async () => {
    const corpus = [stored("a", 0, "doc-1"), stored("b", 1, "doc-1"), stored("c", 1, "doc-2")];
    const r = new TranscriptExpander({ windowSeconds: 30 });
    const out = await r.expand([contextChunk("a", 0, "doc-1")], {
      chunkRepository: repo(corpus),
      toContextChunk: async (chunk, score) => ({
        ...contextChunk("n", 0, String(chunk.documentId)),
        chunkId: chunk.id,
        documentId: chunk.documentId,
        score,
      }),
    });
    expect(out.map((c) => c.documentId)).not.toContain(createDocumentId("doc-2"));
  });
});
