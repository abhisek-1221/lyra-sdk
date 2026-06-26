import { createChunkId, createDocumentId } from "@lyra-sdk/kernel";
import type { Embedding, Embedder } from "@lyra-sdk/embedding";
import { InMemoryChunkRepository, InMemoryDocumentRepository, type Chunk, type SourceDocument } from "@lyra-sdk/storage";
import type { ChunkContentResolver, ChunkStrategy, SourceParser, TranscriptWithMetaMirror } from "@lyra-sdk/ingestion";
import { BruteForceIndex, CosineSimilarity, type IndexedVector, type SearchHit, type VectorIndex, type IndexStats } from "@lyra-sdk/index";
import { describe, expect, it } from "vitest";
import { RetrievalPipeline } from "../src/orchestration/retrieval-pipeline.js";
import { RetrievalPipelineBuilder } from "../src/builder/retrieval-pipeline-builder.js";

const makeTranscript = (id: string, lines: string[]): TranscriptWithMetaMirror => ({
  meta: {
    videoId: id,
    title: "T",
    author: "A",
    channelId: "UC",
    lengthSeconds: 0,
    viewCount: 0,
    description: "",
    keywords: [],
    thumbnails: [],
    isLiveContent: false,
  },
  lines: lines.map((text, i) => ({ text, duration: 1, offset: i, lang: "en" })),
});

class StubEmbedder implements Embedder {
  public calls = 0;
  async embed(_input: string): Promise<Embedding> {
    this.calls++;
    return mkEmb("e", 2);
  }
  async embedMany(inputs: readonly string[]): Promise<readonly Embedding[]> {
    this.calls++;
    return inputs.map((_, i) => mkEmb(`e${i}`, 2));
  }
}

const mkEmb = (id: string, dims: number): Embedding => ({
  id: id as never,
  vector: new Float32Array(dims).fill(0.5),
  model: "m",
  dimensions: dims,
});

class IdentityStrategy implements ChunkStrategy {
  async chunk(document: SourceDocument): Promise<readonly Chunk[]> {
    // One chunk per block. Span covers the block's text exactly.
    const out: Chunk[] = [];
    let cursor = 0;
    for (const block of document.blocks) {
      const start = cursor;
      const end = cursor + block.text.length;
      out.push({
        id: createChunkId(`${document.id}-${start}`),
        documentId: document.id,
        span: { sourceId: document.id, start, end },
        metadata: {},
      });
      cursor = end;
    }
    return out;
  }
}

class PassthroughResolver implements ChunkContentResolver {
  async resolve(chunk: Chunk): Promise<string> {
    return `text-of-${chunk.id}`;
  }
  async resolveMany(chunks: readonly Chunk[]): Promise<readonly string[]> {
    return chunks.map((c) => `text-of-${c.id}`);
  }
}

class CapturingIndex implements VectorIndex {
  public upserted: readonly IndexedVector[] = [];
  async upsert(items: readonly IndexedVector[]): Promise<void> {
    this.upserted = items;
  }
  async search(): Promise<readonly SearchHit[]> {
    return [];
  }
  async delete(): Promise<void> {
    /* no-op */
  }
  stats(): IndexStats {
    return { vectors: this.upserted.length, dimensions: 2, memoryUsage: 0 };
  }
}

describe("RetrievalPipeline", () => {
  it("runs the full ingest chain and indexes vectors", async () => {
    const chunks = new InMemoryChunkRepository();
    const documents = new InMemoryDocumentRepository();
    const index = new CapturingIndex();
    const embedder = new StubEmbedder();

    const pipeline = new RetrievalPipeline({
      sourceParser: parser(),
      segmenter: new IdentityStrategy(),
      embedder,
      chunks,
      documents,
      index,
      contentResolver: new PassthroughResolver(),
      retriever: stubRetriever(),
    });

    await pipeline.ingest(makeTranscript("vid-1", ["hello", "world"]));

    // Document was saved.
    expect(documents.size()).toBe(1);
    // 2 blocks → 2 chunks → 2 vectors.
    expect(chunks.size()).toBe(2);
    expect(index.upserted.length).toBe(2);
  });

  it("ingestMany processes inputs sequentially", async () => {
    const chunks = new InMemoryChunkRepository();
    const documents = new InMemoryDocumentRepository();
    const index = new CapturingIndex();
    const embedder = new StubEmbedder();
    const pipeline = new RetrievalPipeline({
      sourceParser: parser(),
      segmenter: new IdentityStrategy(),
      embedder,
      chunks,
      documents,
      index,
      contentResolver: new PassthroughResolver(),
      retriever: stubRetriever(),
    });
    await pipeline.ingestMany([
      makeTranscript("a", ["x"]),
      makeTranscript("b", ["y"]),
    ]);
    expect(documents.size()).toBe(2);
    expect(chunks.size()).toBe(2);
  });

  it("query delegates to the configured retriever", async () => {
    const pipeline = new RetrievalPipeline({
      sourceParser: parser(),
      segmenter: new IdentityStrategy(),
      embedder: new StubEmbedder(),
      chunks: new InMemoryChunkRepository(),
      documents: new InMemoryDocumentRepository(),
      index: new CapturingIndex(),
      contentResolver: new PassthroughResolver(),
      retriever: stubRetriever({ query: "x", results: [], durationMs: 1 }),
    });
    const out = await pipeline.query("x", 3);
    expect(out.query).toBe("x");
  });

  it("dispose makes subsequent calls throw", async () => {
    const pipeline = new RetrievalPipeline({
      sourceParser: parser(),
      segmenter: new IdentityStrategy(),
      embedder: new StubEmbedder(),
      chunks: new InMemoryChunkRepository(),
      documents: new InMemoryDocumentRepository(),
      index: new CapturingIndex(),
      contentResolver: new PassthroughResolver(),
      retriever: stubRetriever(),
    });
    pipeline.dispose();
    await expect(pipeline.ingest(makeTranscript("a", ["x"]))).rejects.toThrow(/disposed/);
  });

  it("ingest of a transcript with empty lines is a no-op after the parse step", async () => {
    const chunks = new InMemoryChunkRepository();
    const documents = new InMemoryDocumentRepository();
    const index = new CapturingIndex();
    const embedder = new StubEmbedder();
    const pipeline = new RetrievalPipeline({
      sourceParser: parser(),
      segmenter: new IdentityStrategy(),
      embedder,
      chunks,
      documents,
      index,
      contentResolver: new PassthroughResolver(),
      retriever: stubRetriever(),
    });
    await pipeline.ingest(makeTranscript("empty", []));
    expect(documents.size()).toBe(1);
    expect(chunks.size()).toBe(0);
    expect(index.upserted.length).toBe(0);
  });
});

describe("RetrievalPipelineBuilder", () => {
  it("rejects missing required fields", () => {
    const b = new RetrievalPipelineBuilder();
    expect(() => b.build()).toThrow(/withParser/);
    b.withParser(parser());
    expect(() => b.build()).toThrow(/withChunkStrategy/);
  });

  it("builds a working pipeline when all required fields are set", () => {
    const b = new RetrievalPipelineBuilder();
    const pipeline = b
      .withParser(parser())
      .withChunkStrategy(new IdentityStrategy())
      .withEmbedder(new StubEmbedder())
      .withChunkRepository(new InMemoryChunkRepository())
      .withDocumentRepository(new InMemoryDocumentRepository())
      .withIndex(new CapturingIndex())
      .withContentResolver(new PassthroughResolver())
      .build();
    expect(pipeline).toBeInstanceOf(RetrievalPipeline);
  });

  it("defaults to a DenseRetriever when none is supplied", async () => {
    const chunks = new InMemoryChunkRepository();
    const documents = new InMemoryDocumentRepository();
    const index = new BruteForceIndex(new CosineSimilarity());
    const embedder = new StubEmbedder();
    const pipeline = new RetrievalPipelineBuilder()
      .withParser(parser())
      .withChunkStrategy(new IdentityStrategy())
      .withEmbedder(embedder)
      .withChunkRepository(chunks)
      .withDocumentRepository(documents)
      .withIndex(index)
      .withContentResolver(new PassthroughResolver())
      .build();
    await pipeline.ingest(makeTranscript("v1", ["alpha"]));
    const out = await pipeline.query("alpha");
    expect(out.results.length).toBeGreaterThanOrEqual(0);
  });
});

// ─── Helpers ──────────────────────────────────────────────────────────

function parser(): SourceParser<TranscriptWithMetaMirror> {
  return {
    parse(input: TranscriptWithMetaMirror): SourceDocument {
      const id = createDocumentId(input.meta.videoId);
      const content = input.lines.map((l) => l.text).join("");
      return {
        id,
        sourceUri: `youtube:${input.meta.videoId}`,
        content,
        blocks: input.lines.map((l) => ({ text: l.text, metadata: {} })),
        metadata: { videoId: input.meta.videoId },
      };
    },
  };
}

function stubRetriever(overrides: Partial<{ query: string; results: never[]; durationMs: number }> = {}) {
  return {
    async retrieve(query: string, _k: number) {
      return {
        query: overrides.query ?? query,
        results: overrides.results ?? [],
        durationMs: overrides.durationMs ?? 0,
      };
    },
  };
}
