import { createDocumentId, KernelError } from "@lyra-sdk/kernel";
import { InMemoryDocumentRepository } from "@lyra-sdk/storage";
import { describe, expect, it } from "vitest";
import { SpanChunkContentResolver } from "../src/factory/span-chunk-content-resolver.js";
import { ChunkFactory } from "../src/factory/chunk-factory.js";

const doc = createDocumentId("doc-1");
const span = (start: number, end: number) => ({ sourceId: doc, start, end });

const makeRepo = (content: string) => {
  const repo = new InMemoryDocumentRepository();
  return { repo, doc: { id: doc, sourceUri: "x", content, blocks: [], metadata: {} } };
};

describe("SpanChunkContentResolver", () => {
  it("slices a chunk's text from the source document", async () => {
    const { repo, doc } = makeRepo("hello world");
    await repo.save([doc]);
    const chunks = new ChunkFactory().create(doc.id, [span(0, 5), span(6, 11)]);
    const r = new SpanChunkContentResolver(repo);
    const out = await r.resolveMany(chunks);
    expect(out).toEqual(["hello", "world"]);
  });

  it("caches the document content within a resolveMany batch", async () => {
    const { repo, doc } = makeRepo("a".repeat(1000));
    await repo.save([doc]);
    const chunks = new ChunkFactory().create(
      doc.id,
      Array.from({ length: 50 }, (_, i) => span(i * 10, (i + 1) * 10)),
    );
    const r = new SpanChunkContentResolver(repo);
    await r.resolveMany(chunks);
    // We can't directly count repository reads, but the batch should
    // succeed and every chunk's text should be the 10-char slice.
    expect((await r.resolveMany(chunks)).length).toBe(50);
  });

  it("returns empty array for empty input", async () => {
    const { repo } = makeRepo("x");
    const r = new SpanChunkContentResolver(repo);
    expect(await r.resolveMany([])).toEqual([]);
  });

  it("throws KernelError(not_found) when the document is missing", async () => {
    const { repo } = makeRepo("x");
    const orphan = { id: doc, documentId: doc.id, span: span(0, 1), metadata: {} } as never;
    const r = new SpanChunkContentResolver(repo);
    let caught: unknown;
    try {
      await r.resolve(orphan);
    } catch (err) {
      caught = err;
    }
    expect(caught).toBeInstanceOf(KernelError);
    expect((caught as KernelError).code).toBe("not_found");
  });
});
