import { createChunkId, createDocumentId } from "@lyra-sdk/kernel";
import { describe, expect, it } from "vitest";
import { InMemoryChunkRepository } from "../src/in-memory/in-memory-chunk-repository.js";

const docA = createDocumentId("doc-a");

const makeChunk = (suffix: string, start: number, end: number) => ({
  id: createChunkId(`chunk-${suffix}`),
  documentId: docA,
  span: { sourceId: docA, start, end },
  metadata: {},
});

describe("InMemoryChunkRepository", () => {
  it("starts empty", () => {
    const repo = new InMemoryChunkRepository();
    expect(repo.size()).toBe(0);
  });

  it("saves and retrieves a single chunk", async () => {
    const repo = new InMemoryChunkRepository();
    const c = makeChunk("a", 0, 10);
    await repo.save([c]);
    expect(repo.size()).toBe(1);
    const got = await repo.get(c.id);
    expect(got).toEqual(c);
  });

  it("saves many chunks in one call", async () => {
    const repo = new InMemoryChunkRepository();
    const batch = [makeChunk("a", 0, 5), makeChunk("b", 5, 10), makeChunk("c", 10, 15)];
    await repo.save(batch);
    expect(repo.size()).toBe(3);
  });

  it("upserts on duplicate id", async () => {
    const repo = new InMemoryChunkRepository();
    const original = makeChunk("a", 0, 10);
    const updated = { ...original, span: { sourceId: docA, start: 0, end: 99 } };
    await repo.save([original]);
    await repo.save([updated]);
    expect(repo.size()).toBe(1);
    const got = await repo.get(original.id);
    expect(got?.span.end).toBe(99);
  });

  it("returns null for an unknown id", async () => {
    const repo = new InMemoryChunkRepository();
    const got = await repo.get(createChunkId("missing"));
    expect(got).toBeNull();
  });

  it("getMany preserves order and fills nulls", async () => {
    const repo = new InMemoryChunkRepository();
    const a = makeChunk("a", 0, 5);
    const b = makeChunk("b", 5, 10);
    await repo.save([a, b]);
    const result = await repo.getMany([b.id, createChunkId("missing"), a.id]);
    expect(result.length).toBe(3);
    expect(result[0]?.id).toBe(b.id);
    expect(result[1]).toBeNull();
    expect(result[2]?.id).toBe(a.id);
  });

  it("delete is idempotent", async () => {
    const repo = new InMemoryChunkRepository();
    const c = makeChunk("a", 0, 10);
    await repo.save([c]);
    await repo.delete(c.id);
    await repo.delete(c.id);
    expect(repo.size()).toBe(0);
  });

  it("dispose clears the store", async () => {
    const repo = new InMemoryChunkRepository();
    await repo.save([makeChunk("a", 0, 5)]);
    repo.dispose();
    expect(repo.size()).toBe(0);
  });
});
