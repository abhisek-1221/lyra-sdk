import { describe, expect, it } from "vitest";
import type { Embedding, Embedder } from "@lyra-sdk/embedding";
import type { HttpRequest, HttpResponse, HttpTransport } from "@lyra-sdk/embedding";
import { OpenAIGenerator } from "@lyra-sdk/generation";
import { buildYoutubeQaPipeline } from "../src/pipeline.js";

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

function sse(events: readonly { data: string; event?: string }[]): string {
  return events.map((e) => (e.event ? `event: ${e.event}\n` : "") + `data: ${e.data}\n\n`).join("");
}

describe("apps/youtube-qa", () => {
  it("runs the full RAG chain end-to-end with a stub generator", async () => {
    const transport = new StubTransport({
      status: 200,
      bodyText: sse([{ data: '{"choices":[{"delta":{"content":"the answer"}}]}' }, { data: "[DONE]" }]),
    });
    const generator = new OpenAIGenerator({ apiKey: "sk-test", transport });
    const pipeline = buildYoutubeQaPipeline({ embedder: new StubEmbedder(), generator });
    await pipeline.ingest({
      meta: { videoId: "vid-1" as never, title: "T", author: "A", channelId: "UC", lengthSeconds: 0, viewCount: 0, description: "", keywords: [], thumbnails: [], isLiveContent: false },
      lines: [{ text: "the rain in spain", duration: 1, offset: 0, lang: "en" }],
    });
    const result = await pipeline.ask({ query: "What is the rain?" });
    expect(result.generation.text).toBe("the answer");
    expect(result.generation.provider).toBe("openai");
    pipeline.dispose();
  });
});
