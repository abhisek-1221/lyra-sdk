/**
 * The streaming example. Streams a generator's response
 * token-by-token and prints each chunk to stdout.
 */
import { describe, expect, it } from "vitest";
import type { Embedding, Embedder } from "@lyra-sdk/embedding";
import type { HttpRequest, HttpResponse, HttpTransport } from "@lyra-sdk/embedding";
import { OpenAIGenerator, type GenerationChunk } from "@lyra-sdk/generation";
import { BruteForceIndex, CosineSimilarity } from "@lyra-sdk/index";
import { InMemoryChunkRepository, InMemoryDocumentRepository } from "@lyra-sdk/storage";
import { DenseRetriever } from "@lyra-sdk/retrieval";
import { DefaultPromptBuilder } from "@lyra-sdk/prompt";
import { RetrievalPipeline } from "@lyra-sdk/pipeline";
import { SpanChunkContentResolver } from "@lyra-sdk/ingestion";

class StubEmbedder implements Embedder {
  async embed(_input: string): Promise<Embedding> {
    return { id: "e" as never, vector: new Float32Array([0.5, 0.5]), model: "m", dimensions: 2 };
  }
  async embedMany(inputs: readonly string[]): Promise<readonly Embedding[]> {
    return inputs.map((_, i) => ({ id: `e${i}` as never, vector: new Float32Array([0.5, 0.5]), model: "m", dimensions: 2 }));
  }
}

class StubTransport implements HttpTransport {
  public readonly requests: HttpRequest[] = [];
  constructor(private readonly response: HttpResponse) {}
  public async send(request: HttpRequest): Promise<HttpResponse> {
    this.requests.push(request);
    return this.response;
  }
}

function buildPipeline() {
  const documents = new InMemoryDocumentRepository();
  const chunks = new InMemoryChunkRepository();
  const index = new BruteForceIndex(new CosineSimilarity());
  const retriever = new DenseRetriever({ index, embedder: new StubEmbedder(), chunks });
  return new RetrievalPipeline({
    sourceParser: {
      parse(input: { meta: { videoId: string }; lines: readonly { text: string }[] }) {
        return {
          id: input.meta.videoId as never,
          sourceUri: `youtube:${input.meta.videoId}`,
          content: input.lines.map((l) => l.text).join(" "),
          blocks: input.lines.map((l) => ({ text: l.text, metadata: {} })),
          metadata: { videoId: input.meta.videoId },
        };
      },
    },
    segmenter: {
      async chunk(document) {
        const out = [];
        let cursor = 0;
        for (const block of document.blocks) {
          const start = cursor;
          const end = cursor + block.text.length;
          out.push({
            id: `${document.id}-${start}` as never,
            documentId: document.id as never,
            span: { sourceId: document.id as never, start, end },
            metadata: {},
          });
          cursor = end;
        }
        return out;
      },
    },
    embedder: new StubEmbedder(),
    chunks,
    documents,
    index,
    contentResolver: new SpanChunkContentResolver(documents),
    retriever,
    promptBuilder: new DefaultPromptBuilder(),
  });
}

function sse(events: readonly { data: string; event?: string }[]): string {
  return events.map((e) => (e.event ? `event: ${e.event}\n` : "") + `data: ${e.data}\n\n`).join("");
}

describe("apps/streaming", () => {
  it("streams a generator's response token-by-token", async () => {
    const transport = new StubTransport({
      status: 200,
      bodyText: sse([
        { data: '{"choices":[{"delta":{"content":"Hello"}}]}' },
        { data: '{"choices":[{"delta":{"content":" stream"}}]}' },
        { data: '{"choices":[{"delta":{"content":" world"}}]}' },
        { data: "[DONE]" },
      ]),
    });
    const generator = new OpenAIGenerator({ apiKey: "sk-test", transport });
    const pipeline = buildPipeline();
    await pipeline.ingest({
      meta: { videoId: "vid-1" as never, title: "T", author: "A", channelId: "UC", lengthSeconds: 0, viewCount: 0, description: "", keywords: [], thumbnails: [], isLiveContent: false },
      lines: [{ text: "alpha", duration: 1, offset: 0, lang: "en" }],
    });
    // Build a prompt manually and stream it.
    const prompt = {
      system: "S",
      messages: [{ role: "user" as const, content: "Q" }],
      estimatedInputTokens: 0,
    };
    const textDeltas: string[] = [];
    let doneChunk: GenerationChunk | undefined;
    for await (const chunk of generator.stream({ prompt })) {
      if (chunk.type === "text") textDeltas.push(chunk.delta);
      if (chunk.type === "done") doneChunk = chunk;
    }
    expect(textDeltas).toEqual(["Hello", " stream", " world"]);
    expect(doneChunk?.type).toBe("done");
    if (doneChunk?.type === "done") {
      expect(doneChunk.response.text).toBe("Hello stream world");
      expect(doneChunk.response.provider).toBe("openai");
    }
    pipeline.dispose();
  });
});
