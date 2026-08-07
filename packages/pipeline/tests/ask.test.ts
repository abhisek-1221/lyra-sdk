import { describe, expect, it } from "vitest";
import { createChunkId, createDocumentId } from "@lyra-sdk/kernel";
import type { Embedding, Embedder } from "@lyra-sdk/embedding";
import type { HttpRequest, HttpResponse, HttpTransport } from "@lyra-sdk/embedding";
import { OpenAIGenerator, type Generator } from "@lyra-sdk/generation";
import {
  InMemoryChunkRepository,
  InMemoryDocumentRepository,
  type Chunk,
  type SourceDocument,
} from "@lyra-sdk/storage";
import type { IndexStats, type IndexedVector, type SearchHit, type VectorIndex } from "@lyra-sdk/index";
import type { ChunkStrategy, SourceParser, TranscriptWithMetaMirror } from "@lyra-sdk/ingestion";
import { RetrievalPipeline } from "../src/orchestration/retrieval-pipeline.js";
import { RetrievalPipelineBuilder } from "../src/builder/retrieval-pipeline-builder.js";

class StubTransport implements HttpTransport {
  public readonly requests: HttpRequest[] = [];
  constructor(private readonly response: HttpResponse) {}
  public async send(request: HttpRequest): Promise<HttpResponse> {
    this.requests.push(request);
    return this.response;
  }
}

function sse(events: readonly { data: string; event?: string }[]): string {
  return events.map((e) => (e.event ? `event: ${e.event}\n` : "") + `data: ${e.data}\n\n`).join("");
}

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
  async embed(_input: string): Promise<Embedding> {
    return mkEmb("e", 2);
  }
  async embedMany(inputs: readonly string[]): Promise<readonly Embedding[]> {
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

class StubIndex implements VectorIndex {
  public upserted: readonly IndexedVector[] = [];
  async upsert(items: readonly IndexedVector[]): Promise<void> {
    this.upserted = items;
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
    return { vectors: this.upserted.length, dimensions: 2, memoryUsage: 0 };
  }
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

function buildPipeline(opts: { generator?: Generator } = {}) {
  const documents = new InMemoryDocumentRepository();
  const chunks = new InMemoryChunkRepository();
  const index = new StubIndex();
  const embedder = new StubEmbedder();
  const builder = new RetrievalPipelineBuilder()
    .withParser(parser())
    .withChunkStrategy(new IdentityStrategy())
    .withEmbedder(embedder)
    .withChunkRepository(chunks)
    .withDocumentRepository(documents)
    .withIndex(index)
    .withRetriever(stubRetriever());
  if (opts.generator) builder.withGenerator(opts.generator);
  return builder.build();
}

describe("RetrievalPipeline.ask", () => {
  it("returns an AskResult with pipeline, prompt, and generation", async () => {
    const transport = new StubTransport({
      status: 200,
      bodyText: sse([
        { data: '{"choices":[{"delta":{"content":"Hello"}}]}' },
        { data: '{"choices":[{"delta":{"content":" world"}}]}' },
        { data: "[DONE]" },
      ]),
    });
    const generator = new OpenAIGenerator({ apiKey: "sk-test", transport });
    const pipeline = buildPipeline({ generator });
    await pipeline.ingest(makeTranscript("vid-1", ["hello", "world"]));
    const result = await pipeline.ask({ query: "what was said?" });
    expect(result.pipeline.retrieval.query).toBe("what was said?");
    expect(result.prompt.messages.length).toBeGreaterThan(0);
    expect(result.generation.text).toBe("Hello world");
    expect(result.generation.provider).toBe("openai");
  });

  it("copies citations from Context to GenerationResponse", async () => {
    const transport = new StubTransport({
      status: 200,
      bodyText: sse([{ data: '{"choices":[{"delta":{"content":"x"}}]}' }, { data: "[DONE]" }]),
    });
    const generator = new OpenAIGenerator({ apiKey: "sk-test", transport });
    const pipeline = buildPipeline({ generator });
    await pipeline.ingest(makeTranscript("vid-1", ["alpha"]));
    const result = await pipeline.ask({ query: "x" });
    expect(result.generation.citations).toBe(result.pipeline.context.citations);
  });

  it("bypasses the prompt builder when request.prompt is supplied", async () => {
    const transport = new StubTransport({
      status: 200,
      bodyText: sse([{ data: '{"choices":[{"delta":{"content":"x"}}]}' }, { data: "[DONE]" }]),
    });
    const generator = new OpenAIGenerator({ apiKey: "sk-test", transport });
    const pipeline = buildPipeline({ generator });
    await pipeline.ingest(makeTranscript("vid-1", ["alpha"]));
    const customPrompt = {
      system: "CUSTOM",
      messages: [{ role: "user" as const, content: "Q" }],
      estimatedInputTokens: 0,
    };
    await pipeline.ask({ query: "ignored", prompt: customPrompt });
    const body = JSON.parse(transport.requests[0]!.body);
    expect(body.messages[0].content).toBe("CUSTOM");
    expect(body.messages[1].content).toBe("Q");
  });

  it("throws when no generator is configured", async () => {
    const pipeline = buildPipeline();
    await pipeline.ingest(makeTranscript("vid-1", ["alpha"]));
    await expect(pipeline.ask({ query: "x" })).rejects.toThrow(/generator/);
  });

  it("threads a conversation into the prompt messages", async () => {
    const transport = new StubTransport({
      status: 200,
      bodyText: sse([{ data: '{"choices":[{"delta":{"content":"x"}}]}' }, { data: "[DONE]" }]),
    });
    const generator = new OpenAIGenerator({ apiKey: "sk-test", transport });
    const pipeline = buildPipeline({ generator });
    await pipeline.ingest(makeTranscript("vid-1", ["alpha"]));
    await pipeline.ask({
      query: "follow-up",
      conversation: {
        messages: [
          { role: "user", content: "first" },
          { role: "assistant", content: "first answer" },
        ],
      },
    });
    const body = JSON.parse(transport.requests[0]!.body);
    // The OpenAI mapper prepends a `system` message from the
    // prompt's `system` field. The conversation messages
    // follow. The query user message is last.
    expect(body.messages[0].role).toBe("system");
    expect(body.messages[1]).toEqual({ role: "user", content: "first" });
    expect(body.messages[2]).toEqual({ role: "assistant", content: "first answer" });
    // The last user message is the current turn's query.
    const lastMessage = body.messages[body.messages.length - 1];
    expect(lastMessage.role).toBe("user");
    expect(lastMessage.content).toContain("follow-up");
  });

  it("does not mutate the conversation messages array", async () => {
    const transport = new StubTransport({
      status: 200,
      bodyText: sse([{ data: '{"choices":[{"delta":{"content":"x"}}]}' }, { data: "[DONE]" }]),
    });
    const generator = new OpenAIGenerator({ apiKey: "sk-test", transport });
    const pipeline = buildPipeline({ generator });
    await pipeline.ingest(makeTranscript("vid-1", ["alpha"]));
    const messages = [{ role: "user" as const, content: "first" }];
    const snapshot = [...messages];
    await pipeline.ask({ query: "next", conversation: { messages } });
    expect(messages).toEqual(snapshot);
  });
});
