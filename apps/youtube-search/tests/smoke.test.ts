import { describe, expect, it } from "vitest";
import { BruteForceIndex, CosineSimilarity } from "@lyra-sdk/index";
import { InMemoryChunkRepository, InMemoryDocumentRepository } from "@lyra-sdk/storage";
import type { Embedding, Embedder } from "@lyra-sdk/embedding";
import { DenseRetriever } from "@lyra-sdk/retrieval";
import { RetrievalPipeline } from "@lyra-sdk/pipeline";
import { SpanChunkContentResolver, type SourceParser, type TranscriptWithMetaMirror } from "@lyra-sdk/ingestion";
import { createDocumentId } from "@lyra-sdk/kernel";

class StubEmbedder implements Embedder {
  async embed(_input: string): Promise<Embedding> {
    return { id: "e" as never, vector: new Float32Array([0.5, 0.5]), model: "m", dimensions: 2 };
  }
  async embedMany(inputs: readonly string[]): Promise<readonly Embedding[]> {
    return inputs.map((_, i) => ({ id: `e${i}` as never, vector: new Float32Array([0.5, 0.5]), model: "m", dimensions: 2 }));
  }
}

function transcriptParser(): SourceParser<TranscriptWithMetaMirror> {
  return {
    parse(input: TranscriptWithMetaMirror) {
      return {
        id: createDocumentId(input.meta.videoId),
        sourceUri: `youtube:${input.meta.videoId}`,
        content: input.lines.map((l) => l.text).join(" "),
        blocks: input.lines.map((l) => ({ text: l.text, metadata: {} })),
        metadata: { videoId: input.meta.videoId },
      };
    },
  };
}

function buildPipeline() {
  const documents = new InMemoryDocumentRepository();
  const chunks = new InMemoryChunkRepository();
  const index = new BruteForceIndex(new CosineSimilarity());
  const embedder = new StubEmbedder();
  const parser = transcriptParser();
  const segmenter = {
    async chunk(document: { id: string; blocks: readonly { text: string }[] }) {
      const out = [];
      let cursor = 0;
      for (const block of document.blocks) {
        const start = cursor;
        const end = cursor + block.text.length;
        out.push({
          id: `${document.id}-${start}` as never,
          documentId: createDocumentId(document.id),
          span: { sourceId: createDocumentId(document.id), start, end },
          metadata: {},
        });
        cursor = end;
      }
      return out;
    },
  };
  const retriever = new DenseRetriever({ index, embedder, chunks });
  return new RetrievalPipeline({
    sourceParser: parser,
    segmenter,
    embedder,
    chunks,
    documents,
    index,
    contentResolver: new SpanChunkContentResolver(documents),
    retriever,
  });
}

describe("apps/youtube-search", () => {
  it("ingests a transcript and runs a query", async () => {
    const pipeline = buildPipeline();
    await pipeline.ingest({
      meta: { videoId: "vid-1" as never, title: "T", author: "A", channelId: "UC", lengthSeconds: 0, viewCount: 0, description: "", keywords: [], thumbnails: [], isLiveContent: false },
      lines: [
        { text: "the rain in spain", duration: 1, offset: 0, lang: "en" },
        { text: "falls mainly on the plain", duration: 1, offset: 1, lang: "en" },
      ],
    });
    const result = await pipeline.query("Where does the rain fall?", 5);
    expect(result.retrieval.query).toBe("Where does the rain fall?");
    pipeline.dispose();
  });
});
