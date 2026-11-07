import { createDocumentId, type TextSpan } from "@lyra-sdk/kernel";
import { describe, expect, it } from "vitest";
import { ChunkFactory, projectChunkMetadata } from "../src/factory/chunk-factory.js";
import type { SourceDocument } from "@lyra-sdk/storage";

const doc = createDocumentId("doc-1");
const span = (start: number, end: number): TextSpan => ({ sourceId: doc, start, end });

describe("ChunkFactory", () => {
  it("produces no chunks for no spans", () => {
    const f = new ChunkFactory();
    expect(f.create(doc, [])).toEqual([]);
  });

  it("produces one chunk per span", () => {
    const f = new ChunkFactory();
    const out = f.create(doc, [span(0, 5), span(5, 10), span(10, 15)]);
    expect(out.length).toBe(3);
    expect(out[0]?.span).toEqual(span(0, 5));
    expect(out[2]?.span).toEqual(span(10, 15));
  });

  it("default ids are deterministic across runs", () => {
    const a = new ChunkFactory().create(doc, [span(0, 5), span(5, 10)]);
    const b = new ChunkFactory().create(doc, [span(0, 5), span(5, 10)]);
    expect(a.map((c) => c.id)).toEqual(b.map((c) => c.id));
  });

  it("default ids differ for different spans", () => {
    const f = new ChunkFactory();
    const out = f.create(doc, [span(0, 5), span(5, 10)]);
    expect(out[0]?.id).not.toBe(out[1]?.id);
  });

  it("honors a custom idFor function", () => {
    let counter = 0;
    const f = new ChunkFactory({
      idFor: (_d, _s, i) => `custom-${i}` as ReturnType<typeof createDocumentId>,
    });
    counter = 0;
    const out = f.create(doc, [span(0, 5), span(5, 10)]);
    expect(out[0]?.id).toBe("custom-0");
    expect(out[1]?.id).toBe("custom-1");
  });

  it("chunks carry the source documentId and an empty metadata bag", () => {
    const f = new ChunkFactory();
    const out = f.create(doc, [span(0, 5)]);
    expect(out[0]?.documentId).toBe(doc);
    expect(out[0]?.metadata).toEqual({});
  });
});

describe("projectChunkMetadata", () => {
  it("leaves chunks unchanged when blocks have no content offsets", () => {
    const document: SourceDocument = {
      id: doc,
      sourceUri: "x",
      content: "hello",
      blocks: [{ text: "hello", metadata: { offset: 1 } }],
      metadata: {},
    };
    const chunks = new ChunkFactory().create(doc, [span(0, 5)]);
    expect(projectChunkMetadata(document, chunks)).toBe(chunks);
  });

  it("sets timestamp from the earliest overlapping block and copies speaker", () => {
    const document: SourceDocument = {
      id: doc,
      sourceUri: "x",
      content: "Hello\nworld",
      blocks: [
        { text: "Hello", metadata: { offset: 3, speaker: "Ada", contentStart: 0, contentEnd: 5 } },
        { text: "world", metadata: { offset: 8, speaker: "Bea", contentStart: 6, contentEnd: 11 } },
      ],
      metadata: {},
    };
    const chunks = new ChunkFactory().create(doc, [span(0, 11), span(6, 11)]);
    const projected = projectChunkMetadata(document, chunks);
    expect(projected[0]?.metadata.timestamp).toBe(3);
    expect(projected[0]?.metadata.speaker).toBe("Ada");
    expect(projected[1]?.metadata.timestamp).toBe(8);
    expect(projected[1]?.metadata.speaker).toBe("Bea");
  });
});
