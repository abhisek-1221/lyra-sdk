import { createChunkId, createDocumentId, type TextSpan } from "@lyra-sdk/kernel";
import type { Embedding, Embedder } from "@lyra-sdk/embedding";
import { BM25Index, BruteForceIndex, CosineSimilarity } from "@lyra-sdk/index";
import {
  DenseRetriever,
  BM25Retriever,
  HybridRetriever,
  MultiQueryRetriever,
  ParentDocumentRetriever,
  ReciprocalRankFusion,
  RewriteRetriever,
  IdentityExpander,
  type Retriever,
} from "@lyra-sdk/retrieval";
import { SpanChunkContentResolver } from "@lyra-sdk/ingestion";
import { InMemoryChunkRepository, InMemoryDocumentRepository, type Chunk, type SourceDocument } from "@lyra-sdk/storage";
import { describe, expect, it } from "vitest";
import { RetrievalPipeline } from "../src/orchestration/retrieval-pipeline.js";

/**
 * A tiny deterministic embedder for tests. The "embedding" of
 * a string is a 4-dim Float32Array where each dimension is a
 * hash bucket of the string's characters. This gives us
 * reasonable similarity (similar strings → similar vectors)
 * without any model dependency.
 */
class HashingEmbedder implements Embedder {
  constructor(public readonly dimensions = 4) {}
  async embed(input: string): Promise<Embedding> {
    const v = new Float32Array(this.dimensions);
    for (let i = 0; i < input.length; i++) {
      const c = input.charCodeAt(i);
      v[c % this.dimensions] = (v[c % this.dimensions] ?? 0) + 1;
    }
    // L2-normalize so cosine similarity is well-behaved.
    let sum = 0;
    for (let i = 0; i < v.length; i++) sum += v[i]! * v[i]!;
    const n = Math.sqrt(sum) || 1;
    for (let i = 0; i < v.length; i++) v[i] = v[i]! / n;
    return { id: "e" as never, vector: v, model: "hash", dimensions: this.dimensions };
  }
  async embedMany(inputs: readonly string[]): Promise<readonly Embedding[]> {
    return Promise.all(inputs.map((s) => this.embed(s)));
  }
}

const docId = createDocumentId("vid-1");
const span = (start: number, end: number): TextSpan => ({ sourceId: docId, start, end });
const chunk = (id: string, start: number, end: number): Chunk => ({
  id: createChunkId(id),
  documentId: docId,
  span: span(start, end),
  metadata: {},
});

const transcriptFixture: SourceDocument = {
  id: docId,
  sourceUri: "youtube:vid-1",
  content: "OAuth2 uses access tokens for authentication",
  blocks: [
    { text: "OAuth2 uses access tokens for authentication", metadata: { chunkId: "c1" } },
  ],
  metadata: { videoId: "vid-1" },
};

describe("Phase 2 composition — end-to-end (spec §12)", () => {
  it("ingests and queries a hybrid retriever through the pipeline", async () => {
    const vectorIdx = new BruteForceIndex(new CosineSimilarity());
    const lexical = new BM25Index();
    const embedder = new HashingEmbedder();
    const chunkRepo = new InMemoryChunkRepository();
    const documents = new InMemoryDocumentRepository();
    const resolver = new SpanChunkContentResolver(documents);

    const dense = new DenseRetriever({ index: vectorIdx, embedder, chunks: chunkRepo });
    const bm25 = new BM25Retriever({ index: lexical, chunks: chunkRepo, documents });

    const hybrid = new HybridRetriever({
      retrievers: [dense, bm25],
      fusion: new ReciprocalRankFusion(),
    });

    // The pipeline's withRetriever composes the retriever. The
    // builder auto-creates a default retriever if none is supplied;
    // here we override with the hybrid.
    const pipeline = RetrievalPipeline.builder()
      .withParser({ parse: () => transcriptFixture } as never)
      .withChunkStrategy({ chunk: async () => [chunk("c1", 0, 46)] } as never)
      .withEmbedder(embedder)
      .withChunkRepository(chunkRepo)
      .withDocumentRepository(documents)
      .withIndex(vectorIdx)
      .withContentResolver(resolver)
      .withRetriever(hybrid)
      .withLexicalIndex(lexical)
      .build();

    await pipeline.ingest("ignored — parser is stubbed");

    // The pipeline fed both indexes with the chunk's text.
    expect(lexical.size()).toBe(1);
    expect(vectorIdx.stats().vectors).toBe(1);

    const result = await pipeline.query("OAuth2 access tokens", 5);
    expect(result.query).toBe("OAuth2 access tokens");
    expect(result.results.length).toBeGreaterThan(0);
    // The dense and bm25 retriever share the same chunk; fusion
    // surfaces the chunk once.
    expect(result.results[0]?.chunk.id).toBe("c1");
  });

  it("composes MultiQuery → Hybrid → Parent (the spec's §12 example)", async () => {
    const vectorIdx = new BruteForceIndex(new CosineSimilarity());
    const lexical = new BM25Index();
    const embedder = new HashingEmbedder();
    const chunkRepo = new InMemoryChunkRepository();
    const documents = new InMemoryDocumentRepository();
    const resolver = new SpanChunkContentResolver(documents);

    const dense = new DenseRetriever({ index: vectorIdx, embedder, chunks: chunkRepo });
    const bm25 = new BM25Retriever({ index: lexical, chunks: chunkRepo, documents });

    const hybrid = new HybridRetriever({
      retrievers: [dense, bm25],
      fusion: new ReciprocalRankFusion(),
    });

    // Wrap the hybrid in a multi-query retriever (SynonymExpander's
    // default is too small for this; we use a simple identity with
    // a rewriter to keep the test deterministic and offline).
    const rewritten = new MultiQueryRetriever({
      retriever: hybrid,
      expander: new IdentityExpander(),
    });

    // And the multi-query in a parent retriever.
    const parent = new ParentDocumentRetriever({
      retriever: rewritten,
      documents,
    });

    const pipeline = RetrievalPipeline.builder()
      .withParser({ parse: () => transcriptFixture } as never)
      .withChunkStrategy({ chunk: async () => [chunk("c1", 0, 46)] } as never)
      .withEmbedder(embedder)
      .withChunkRepository(chunkRepo)
      .withDocumentRepository(documents)
      .withIndex(vectorIdx)
      .withContentResolver(resolver)
      .withRetriever(parent)
      .withLexicalIndex(lexical)
      .build();

    await pipeline.ingest("ignored — parser is stubbed");

    const result = await pipeline.query("How do I authenticate?", 5);
    expect(result.query).toBe("How do I authenticate?");
    // The parent's contract: a fully-resolved chunk per hit.
    expect(result.results[0]?.chunk.id).toBe("c1");
  });

  it("a RewriteRetriever wrapping a DenseRetriever works through the pipeline", async () => {
    const vectorIdx = new BruteForceIndex(new CosineSimilarity());
    const embedder = new HashingEmbedder();
    const chunkRepo = new InMemoryChunkRepository();
    const documents = new InMemoryDocumentRepository();
    const resolver = new SpanChunkContentResolver(documents);

    const dense = new DenseRetriever({ index: vectorIdx, embedder, chunks: chunkRepo });
    const inner = new RewriteRetriever({ retriever: dense, fillerWords: [] });

    const pipeline = RetrievalPipeline.builder()
      .withParser({ parse: () => transcriptFixture } as never)
      .withChunkStrategy({ chunk: async () => [chunk("c1", 0, 46)] } as never)
      .withEmbedder(embedder)
      .withChunkRepository(chunkRepo)
      .withDocumentRepository(documents)
      .withIndex(vectorIdx)
      .withContentResolver(resolver)
      .withRetriever(inner)
      .build();

    await pipeline.ingest("ignored");
    const result = await pipeline.query("OAuth2", 5);
    expect(result.results.length).toBeGreaterThan(0);
  });
});
