import { describe, expect, it } from "vitest";
import { createDocumentId } from "@lyra-sdk/kernel";
import type { Embedding, Embedder } from "@lyra-sdk/embedding";
import type { HttpRequest, HttpResponse, HttpTransport } from "@lyra-sdk/embedding";
import { OpenAIGenerator } from "@lyra-sdk/generation";
import type { IndexStats, IndexedVector, SearchHit, VectorIndex } from "@lyra-sdk/index";
import {
  RecursiveChunkStrategy,
  SpanChunkContentResolver,
  TranscriptParser,
  type SourceParser,
  type TranscriptWithMetaMirror,
} from "@lyra-sdk/ingestion";
import { DefaultContextBuilder, TranscriptExpander } from "@lyra-sdk/context";
import { DefaultPromptBuilder } from "@lyra-sdk/prompt";
import { InMemoryChunkRepository, InMemoryDocumentRepository } from "@lyra-sdk/storage";
import { RetrievalPipelineBuilder } from "../src/builder/retrieval-pipeline-builder.js";

class StubEmbedder implements Embedder {
  async embed(): Promise<Embedding> {
    return { id: "e" as never, vector: new Float32Array([1, 0]), model: "m", dimensions: 2 };
  }
  async embedMany(inputs: readonly string[]): Promise<readonly Embedding[]> {
    return inputs.map((_, i) => ({
      id: `e${i}` as never,
      vector: new Float32Array([1, 0]),
      model: "m",
      dimensions: 2,
    }));
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

class StubIndex implements VectorIndex {
  async upsert(): Promise<void> {}
  async search(): Promise<readonly SearchHit[]> {
    return [];
  }
  async getMany(): Promise<readonly (IndexedVector | null)[]> {
    return [];
  }
  async delete(): Promise<void> {}
  stats(): IndexStats {
    return { vectors: 0, dimensions: 2, memoryUsage: 0 };
  }
}

function sse(events: readonly { data: string }[]): string {
  return events.map((event) => `data: ${event.data}\n\n`).join("");
}

describe("transcript context pipeline", () => {
  it("keeps timestamps, labels a citation, and matches the prompt footer", async () => {
    const documents = new InMemoryDocumentRepository();
    const chunks = new InMemoryChunkRepository();
    const resolver = new SpanChunkContentResolver(documents);
    const inner = new TranscriptParser();
    const parser: SourceParser<TranscriptWithMetaMirror> = {
      parse(input) {
        const doc = inner.parse(input);
        const blocks = doc.blocks.map((block, index) =>
          index === 0 ? { ...block, metadata: { ...block.metadata, speaker: "Ada" } } : block,
        );
        return { ...doc, blocks };
      },
    };
    const line = "a".repeat(80);
    const transcript: TranscriptWithMetaMirror = {
      meta: {
        videoId: "vid",
        title: "Talk",
        author: "A",
        channelId: "UC",
        lengthSeconds: 60,
        viewCount: 1,
        description: "",
        keywords: [],
        thumbnails: [],
        isLiveContent: false,
      },
      lines: [
        { text: line, duration: 2, offset: 3, lang: "en" },
        { text: "b".repeat(80), duration: 2, offset: 8, lang: "en" },
      ],
    };
    const transport = new StubTransport({
      status: 200,
      bodyText: sse([{ data: '{"choices":[{"delta":{"content":"ok"}}]}' }, { data: "[DONE]" }]),
    });
    const pipeline = new RetrievalPipelineBuilder()
      .withParser(parser)
      .withChunkStrategy(new RecursiveChunkStrategy({ splitter: { chunkSize: 40 }, merger: { chunkSize: 40 } }))
      .withEmbedder(new StubEmbedder())
      .withChunkRepository(chunks)
      .withDocumentRepository(documents)
      .withIndex(new StubIndex())
      .withContentResolver(resolver)
      .withRetriever({
        async retrieve(query: string) {
          const all = await chunks.listByDocument(createDocumentId("vid"));
          const first = [...all].sort((a, b) => a.span.start - b.span.start)[0];
          return {
            query,
            results: first === undefined ? [] : [{ chunk: first, score: 0.9 }],
            durationMs: 0,
          };
        },
      })
      .withContextBuilder(
        new DefaultContextBuilder({
          tokenBudget: 4000,
          resolver,
          documents,
          chunkRepository: chunks,
          expander: new TranscriptExpander({ windowSeconds: 30 }),
        }),
      )
      .withPromptBuilder(new DefaultPromptBuilder())
      .withGenerator(new OpenAIGenerator({ apiKey: "sk-test", transport }))
      .build();

    await pipeline.ingest(transcript);
    const result = await pipeline.ask({ query: "What was said?" });
    const context = result.pipeline.context;
    expect(context.chunks).toHaveLength(1);
    expect(context.chunks[0]?.timestamp).toBe(3);
    expect(context.chunks[0]?.speaker).toBe("Ada");
    expect(context.citations.length).toBeGreaterThan(1);
    expect(context.citations.every((citation) => citation.marker === 1)).toBe(true);
    expect(context.citations[0]?.label).toBe("Talk");
    expect(context.citations[0]?.url).toContain("watch?v=vid");
    expect(context.citations[0]?.url).toContain("t=3");
    const user = result.prompt.messages.at(-1)?.content ?? "";
    expect(user).toContain("[1]");
    expect(user).toContain("Ada @ 00:03");
    expect(user).toContain("Sources:");
    expect(user).toContain("Talk @ 00:03");
    expect(result.generation.citations).toBe(context.citations);
  });
});
