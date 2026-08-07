import { createChunkId, createDocumentId } from "@lyra-sdk/kernel";
import type { Embedding, Embedder } from "@lyra-sdk/embedding";
import type { Chunk, SourceDocument } from "@lyra-sdk/storage";
import { InMemoryChunkRepository, InMemoryDocumentRepository } from "@lyra-sdk/storage";
import type { ChunkContentResolver, ChunkStrategy, SourceParser, TranscriptWithMetaMirror } from "@lyra-sdk/ingestion";
import { BruteForceIndex, CosineSimilarity, type IndexedVector, type SearchHit, type VectorIndex, type IndexStats } from "@lyra-sdk/index";
import { DefaultContextBuilder } from "@lyra-sdk/context";
import type { Reranker, RerankResult } from "@lyra-sdk/reranking";
import type { Retriever, ScoredChunk, RetrievalResult } from "@lyra-sdk/retrieval";
import { describe, expect, it } from "vitest";
import { RetrievalPipelineBuilder } from "../src/builder/retrieval-pipeline-builder.js";

class StubEmbedder implements Embedder {
  async embed(): Promise<Embedding> {
    return {
      id: "e" as never,
      vector: new Float32Array(2).fill(0.5),
      model: "m",
      dimensions: 2,
    };
  }
  async embedMany(inputs: readonly string[]): Promise<readonly Embedding[]> {
    return inputs.map((_, i) => ({
      id: `e${i}` as never,
      vector: new Float32Array(2).fill(0.5),
      model: "m",
      dimensions: 2,
    }));
  }
}

class IdentityStrategy implements ChunkStrategy {
  async chunk(document: SourceDocument): Promise<readonly Chunk[]> {
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
  async upsert(): Promise<void> {
    /* no-op */
  }
  async search(): Promise<readonly SearchHit[]> {
    return [];
  }
  async getMany(): Promise<readonly (IndexedVector | null)[]> {
    return [];
  }
  async delete(): Promise<void> {
    /* no-op */
  }
  stats(): IndexStats {
    return { vectors: 0, dimensions: 2, memoryUsage: 0 };
  }
}

class StubRetriever implements Retriever {
  public readonly name = "stub";
  constructor(private readonly output: readonly ScoredChunk[]) {}
  async retrieve(query: string): Promise<RetrievalResult> {
    return { query, results: this.output, durationMs: 0 };
  }
}

class IdentityReranker implements Reranker {
  public readonly name = "identity-reranker";
  async rerank(_query: string, candidates: readonly ScoredChunk[]): Promise<RerankResult> {
    return { results: candidates, durationMs: 0 };
  }
}

class ReverserReranker implements Reranker {
  public readonly name = "reverser-reranker";
  async rerank(_query: string, candidates: readonly ScoredChunk[]): Promise<RerankResult> {
    return { results: [...candidates].reverse(), durationMs: 0 };
  }
}

function makeTranscript(id: string, lines: string[]): TranscriptWithMetaMirror {
  return {
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
  };
}

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

describe("RetrievalPipeline with reranker and context builder", () => {
  it("returns PipelineResult with retrieval, reranked, context", async () => {
    const sc: ScoredChunk = {
      chunk: {
        id: createChunkId("c-1"),
        documentId: createDocumentId("doc-1"),
        span: { start: 0, end: 5, sourceId: createDocumentId("doc-1") },
        metadata: {},
      },
      score: 0.9,
    };
    const documents = new InMemoryDocumentRepository();
    const docMap = new Map<string, SourceDocument>([
      [
        "doc-1",
        {
          id: createDocumentId("doc-1"),
          sourceUri: "x",
          content: "hello world",
          blocks: [{ text: "hello world", metadata: {} }],
          metadata: {},
        },
      ],
    ]);
    const pipeline = new RetrievalPipelineBuilder()
      .withParser(parser())
      .withChunkStrategy(new IdentityStrategy())
      .withEmbedder(new StubEmbedder())
      .withChunkRepository(new InMemoryChunkRepository())
      .withDocumentRepository(documents)
      .withIndex(new CapturingIndex())
      .withContentResolver(new PassthroughResolver())
      .withRetriever(new StubRetriever([sc]))
      .withReranker(new ReverserReranker())
      .withContextBuilder(new DefaultContextBuilder({ tokenBudget: 100, documents: docMap }))
      .build();
    const out = await pipeline.query("q");
    expect(out.retrieval.results).toHaveLength(1);
    expect(out.reranked).toHaveLength(1);
    expect(out.context.chunks).toHaveLength(1);
  });

  it("reranked === retrieval.results when no reranker is configured", async () => {
    const sc: ScoredChunk = {
      chunk: {
        id: createChunkId("c-1"),
        documentId: createDocumentId("doc-1"),
        span: { start: 0, end: 5, sourceId: createDocumentId("doc-1") },
        metadata: {},
      },
      score: 0.9,
    };
    const pipeline = new RetrievalPipelineBuilder()
      .withParser(parser())
      .withChunkStrategy(new IdentityStrategy())
      .withEmbedder(new StubEmbedder())
      .withChunkRepository(new InMemoryChunkRepository())
      .withDocumentRepository(new InMemoryDocumentRepository())
      .withIndex(new CapturingIndex())
      .withContentResolver(new PassthroughResolver())
      .withRetriever(new StubRetriever([sc]))
      .build();
    const out = await pipeline.query("q");
    expect(out.reranked).toEqual(out.retrieval.results);
  });

  it("context is an empty Context when no builder is configured", async () => {
    const sc: ScoredChunk = {
      chunk: {
        id: createChunkId("c-1"),
        documentId: createDocumentId("doc-1"),
        span: { start: 0, end: 5, sourceId: createDocumentId("doc-1") },
        metadata: {},
      },
      score: 0.9,
    };
    const pipeline = new RetrievalPipelineBuilder()
      .withParser(parser())
      .withChunkStrategy(new IdentityStrategy())
      .withEmbedder(new StubEmbedder())
      .withChunkRepository(new InMemoryChunkRepository())
      .withDocumentRepository(new InMemoryDocumentRepository())
      .withIndex(new CapturingIndex())
      .withContentResolver(new PassthroughResolver())
      .withRetriever(new StubRetriever([sc]))
      .build();
    const out = await pipeline.query("q");
    expect(out.context.chunks).toEqual([]);
    expect(out.context.usedTokens).toBe(0);
    expect(out.context.tokenBudget).toBe(0);
    expect(out.context.truncated).toBe(false);
  });

  it("reranker is invoked with the retrieval results", async () => {
    const sc: ScoredChunk = {
      chunk: {
        id: createChunkId("c-1"),
        documentId: createDocumentId("doc-1"),
        span: { start: 0, end: 5, sourceId: createDocumentId("doc-1") },
        metadata: {},
      },
      score: 0.9,
    };
    let received: readonly ScoredChunk[] = [];
    const r: Reranker = {
      name: "spy",
      async rerank(_q, candidates) {
        received = candidates;
        return { results: candidates, durationMs: 0 };
      },
    };
    const pipeline = new RetrievalPipelineBuilder()
      .withParser(parser())
      .withChunkStrategy(new IdentityStrategy())
      .withEmbedder(new StubEmbedder())
      .withChunkRepository(new InMemoryChunkRepository())
      .withDocumentRepository(new InMemoryDocumentRepository())
      .withIndex(new CapturingIndex())
      .withContentResolver(new PassthroughResolver())
      .withRetriever(new StubRetriever([sc]))
      .withReranker(r)
      .build();
    await pipeline.query("q");
    expect(received).toHaveLength(1);
    expect(received[0]).toBe(sc);
  });

  it("context builder is invoked with the reranked candidates", async () => {
    const sc: ScoredChunk = {
      chunk: {
        id: createChunkId("c-1"),
        documentId: createDocumentId("doc-1"),
        span: { start: 0, end: 5, sourceId: createDocumentId("doc-1") },
        metadata: {},
      },
      score: 0.9,
    };
    let received: readonly ScoredChunk[] = [];
    const builder = {
      name: "spy-builder",
      build: async (c: readonly ScoredChunk[]) => {
        received = c;
        return {
          chunks: [],
          citations: [],
          usedTokens: 0,
          tokenBudget: 0,
          truncated: false,
          diagnostics: {},
        };
      },
    };
    const pipeline = new RetrievalPipelineBuilder()
      .withParser(parser())
      .withChunkStrategy(new IdentityStrategy())
      .withEmbedder(new StubEmbedder())
      .withChunkRepository(new InMemoryChunkRepository())
      .withDocumentRepository(new InMemoryDocumentRepository())
      .withIndex(new CapturingIndex())
      .withContentResolver(new PassthroughResolver())
      .withRetriever(new StubRetriever([sc]))
      .withReranker(new IdentityReranker())
      .withContextBuilder(builder)
      .build();
    await pipeline.query("q");
    expect(received).toHaveLength(1);
  });
});
