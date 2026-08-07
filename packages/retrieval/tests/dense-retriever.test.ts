import { createChunkId, createDocumentId } from "@lyra-sdk/kernel";
import type { Embedder, Embedding } from "@lyra-sdk/embedding";
import type { Chunk } from "@lyra-sdk/storage";
import type { IndexedVector, SearchHit, VectorIndex, IndexStats } from "@lyra-sdk/index";
import type { ChunkRepository } from "@lyra-sdk/storage";
import { describe, expect, it } from "vitest";
import { DenseRetriever } from "../src/dense/dense-retriever.js";

class StubEmbedder implements Embedder {
  public calls = 0;
  constructor(private readonly next: Embedding) {}
  async embed(_input: string): Promise<Embedding> {
    this.calls++;
    return this.next;
  }
  async embedMany(inputs: readonly string[]): Promise<readonly Embedding[]> {
    this.calls++;
    if (inputs.length === 0) return [];
    return [this.next];
  }
}

class StubIndex implements VectorIndex {
  public upserted: readonly IndexedVector[] = [];
  constructor(
    private readonly hits: readonly SearchHit[],
    private readonly vectors: ReadonlyMap<string, Float32Array> = new Map(),
  ) {}
  async upsert(items: readonly IndexedVector[]): Promise<void> {
    this.upserted = items;
  }
  async search(_q: Float32Array, k: number): Promise<readonly SearchHit[]> {
    return this.hits.slice(0, k);
  }
  async getMany(
    ids: readonly import("@lyra-sdk/kernel").ChunkId[],
  ): Promise<readonly (IndexedVector | null)[]> {
    return ids.map((id) => {
      const v = this.vectors.get(id);
      return v === undefined ? null : { id, vector: v };
    });
  }
  async delete(): Promise<void> {
    /* no-op */
  }
  stats(): IndexStats {
    return { vectors: this.upserted.length, dimensions: 0, memoryUsage: 0 };
  }
}

class StubChunkRepository implements ChunkRepository {
  public saved: readonly Chunk[] = [];
  constructor(private readonly byId: Map<string, Chunk>) {}
  async save(chunks: readonly Chunk[]): Promise<void> {
    this.saved = chunks;
  }
  async get(id: import("@lyra-sdk/kernel").ChunkId): Promise<Chunk | null> {
    return this.byId.get(id) ?? null;
  }
  async getMany(ids: readonly import("@lyra-sdk/kernel").ChunkId[]): Promise<readonly (Chunk | null)[]> {
    return ids.map((id) => this.byId.get(id) ?? null);
  }
  async delete(): Promise<void> {
    /* no-op */
  }
  size(): number {
    return this.byId.size;
  }
  dispose(): void {
    /* no-op */
  }
}

const doc = createDocumentId("doc-1");
const mkChunk = (suffix: string, start: number, end: number): Chunk => ({
  id: createChunkId(`chunk-${suffix}`),
  documentId: doc,
  span: { sourceId: doc, start, end },
  metadata: {},
});

describe("DenseRetriever", () => {
  it("embeds the query, searches the index, and resolves chunks", async () => {
    const queryEmb: Embedding = {
      id: "emb-q" as never,
      vector: new Float32Array([1, 0, 0]),
      model: "m",
      dimensions: 3,
    };
    const embedder = new StubEmbedder(queryEmb);
    const c1 = mkChunk("a", 0, 5);
    const c2 = mkChunk("b", 5, 10);
    const c3 = mkChunk("c", 10, 15);
    const chunkMap = new Map<string, Chunk>([
      [c1.id, c1],
      [c2.id, c2],
      [c3.id, c3],
    ]);
    const index = new StubIndex([
      { id: c2.id, score: 0.9 },
      { id: c1.id, score: 0.7 },
      { id: c3.id, score: 0.3 },
    ]);
    const chunks = new StubChunkRepository(chunkMap);
    const r = new DenseRetriever({ index, embedder, chunks });

    const out = await r.retrieve("what is X?", 2);
    expect(out.query).toBe("what is X?");
    expect(out.results.length).toBe(2);
    expect(out.results[0]?.chunk.id).toBe(c2.id);
    expect(out.results[0]?.score).toBe(0.9);
    expect(out.results[1]?.chunk.id).toBe(c1.id);
    expect(typeof out.durationMs).toBe("number");
  });

  it("drops candidates that fail to resolve", async () => {
    const queryEmb: Embedding = {
      id: "emb-q" as never,
      vector: new Float32Array([1]),
      model: "m",
      dimensions: 1,
    };
    const embedder = new StubEmbedder(queryEmb);
    const c1 = mkChunk("a", 0, 5);
    const index = new StubIndex([
      { id: c1.id, score: 0.9 },
      { id: createChunkId("missing"), score: 0.5 },
    ]);
    const chunks = new StubChunkRepository(new Map([[c1.id, c1]]));
    const r = new DenseRetriever({ index, embedder, chunks });
    const out = await r.retrieve("q", 5);
    expect(out.results.length).toBe(1);
    expect(out.results[0]?.chunk.id).toBe(c1.id);
  });

  it("returns empty results on an empty index", async () => {
    const queryEmb: Embedding = {
      id: "emb-q" as never,
      vector: new Float32Array([1]),
      model: "m",
      dimensions: 1,
    };
    const r = new DenseRetriever({
      index: new StubIndex([]),
      embedder: new StubEmbedder(queryEmb),
      chunks: new StubChunkRepository(new Map()),
    });
    const out = await r.retrieve("q", 5);
    expect(out.results).toEqual([]);
  });

  it("respects k", async () => {
    const queryEmb: Embedding = {
      id: "emb-q" as never,
      vector: new Float32Array([1]),
      model: "m",
      dimensions: 1,
    };
    const c1 = mkChunk("a", 0, 5);
    const c2 = mkChunk("b", 5, 10);
    const c3 = mkChunk("c", 10, 15);
    const chunkMap = new Map<string, Chunk>([
      [c1.id, c1],
      [c2.id, c2],
      [c3.id, c3],
    ]);
    const r = new DenseRetriever({
      index: new StubIndex([
        { id: c1.id, score: 0.3 },
        { id: c2.id, score: 0.2 },
        { id: c3.id, score: 0.1 },
      ]),
      embedder: new StubEmbedder(queryEmb),
      chunks: new StubChunkRepository(chunkMap),
    });
    const out = await r.retrieve("q", 1);
    expect(out.results.length).toBe(1);
  });
});
