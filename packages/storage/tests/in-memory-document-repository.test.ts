import { createDocumentId } from "@lyra-sdk/kernel";
import { describe, expect, it } from "vitest";
import { InMemoryDocumentRepository } from "../src/in-memory/in-memory-document-repository.js";

const makeDoc = (id: string, content: string) => ({
  id: createDocumentId(id),
  sourceUri: `youtube:${id}`,
  content,
  blocks: [{ text: content, metadata: {} }],
  metadata: { videoId: id },
});

describe("InMemoryDocumentRepository", () => {
  it("starts empty", () => {
    const repo = new InMemoryDocumentRepository();
    expect(repo.size()).toBe(0);
  });

  it("saves and retrieves a document", async () => {
    const repo = new InMemoryDocumentRepository();
    const d = makeDoc("a", "hello world");
    await repo.save([d]);
    expect(repo.size()).toBe(1);
    const got = await repo.get(d.id);
    expect(got).toEqual(d);
  });

  it("saves many in one call", async () => {
    const repo = new InMemoryDocumentRepository();
    await repo.save([makeDoc("a", "x"), makeDoc("b", "y"), makeDoc("c", "z")]);
    expect(repo.size()).toBe(3);
  });

  it("upserts on duplicate id", async () => {
    const repo = new InMemoryDocumentRepository();
    const d1 = makeDoc("a", "first");
    const d2 = makeDoc("a", "second");
    await repo.save([d1]);
    await repo.save([d2]);
    expect(repo.size()).toBe(1);
    const got = await repo.get(d1.id);
    expect(got?.content).toBe("second");
  });

  it("returns null for an unknown id", async () => {
    const repo = new InMemoryDocumentRepository();
    const got = await repo.get(createDocumentId("missing"));
    expect(got).toBeNull();
  });

  it("delete is idempotent", async () => {
    const repo = new InMemoryDocumentRepository();
    const d = makeDoc("a", "x");
    await repo.save([d]);
    await repo.delete(d.id);
    await repo.delete(d.id);
    expect(repo.size()).toBe(0);
  });

  it("dispose clears the store", async () => {
    const repo = new InMemoryDocumentRepository();
    await repo.save([makeDoc("a", "x")]);
    repo.dispose();
    expect(repo.size()).toBe(0);
  });

  it("preserves blocks and metadata round-trip", async () => {
    const repo = new InMemoryDocumentRepository();
    const d = {
      id: createDocumentId("a"),
      sourceUri: "youtube:a",
      content: "line1\nline2",
      blocks: [
        { text: "line1", metadata: { offset: 0 } },
        { text: "line2", metadata: { offset: 6 } },
      ],
      metadata: { videoId: "a", lang: "en" },
    };
    await repo.save([d]);
    const got = await repo.get(d.id);
    expect(got?.blocks.length).toBe(2);
    expect(got?.metadata.lang).toBe("en");
  });
});
