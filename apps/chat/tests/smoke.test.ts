import { describe, expect, it } from "vitest";
import type { Embedding, Embedder } from "@lyra-sdk/embedding";
import type { HttpRequest, HttpResponse, HttpTransport } from "@lyra-sdk/embedding";
import { OpenAIGenerator, type Generator } from "@lyra-sdk/generation";
import { buildChatPipeline } from "../src/pipeline.js";
import type { PromptMessage } from "@lyra-sdk/prompt";

class StubTransport implements HttpTransport {
  public readonly requests: HttpRequest[] = [];
  constructor(private readonly response: HttpResponse) {}
  public async send(request: HttpRequest): Promise<HttpResponse> {
    this.requests.push(request);
    return this.response;
  }
}

class StubEmbedder implements Embedder {
  async embed(_input: string): Promise<Embedding> {
    return { id: "e" as never, vector: new Float32Array([0.5, 0.5]), model: "m", dimensions: 2 };
  }
  async embedMany(inputs: readonly string[]): Promise<readonly Embedding[]> {
    return inputs.map((_, i) => ({ id: `e${i}` as never, vector: new Float32Array([0.5, 0.5]), model: "m", dimensions: 2 }));
  }
}

function sse(events: readonly { data: string; event?: string }[]): string {
  return events.map((e) => (e.event ? `event: ${e.event}\n` : "") + `data: ${e.data}\n\n`).join("");
}

function makeTransport(turn: number): StubTransport {
  return new StubTransport({
    status: 200,
    bodyText: sse([{ data: `{"choices":[{"delta":{"content":"answer-${turn}"}}]}` }, { data: "[DONE]" }]),
  });
}

describe("apps/chat", () => {
  it("runs a 3-turn conversation and threads history through each ask", async () => {
    const transport = makeTransport(1);
    // We need different responses per turn. Replace the
    // transport's response between turns.
    const generator: Generator = new OpenAIGenerator({ apiKey: "sk-test", transport });
    const pipeline = buildChatPipeline({ embedder: new StubEmbedder(), generator });

    await pipeline.ingest({
      meta: { videoId: "vid-1" as never, title: "T", author: "A", channelId: "UC", lengthSeconds: 0, viewCount: 0, description: "", keywords: [], thumbnails: [], isLiveContent: false },
      lines: [{ text: "alpha", duration: 1, offset: 0, lang: "en" }],
    });

    const history: PromptMessage[] = [];
    for (let turn = 1; turn <= 3; turn++) {
      // Override the canned response for the next turn.
      transport.requests.length = 0;
      const bodyText = sse([{ data: `{"choices":[{"delta":{"content":"answer-${turn}"}}]}` }, { data: "[DONE]" }]);
      (transport as unknown as { response: HttpResponse }).response = { status: 200, bodyText };

      const question = `q-${turn}`;
      history.push({ role: "user", content: question });
      const result = await pipeline.ask({ query: question, conversation: { messages: history } });
      history.push({ role: "assistant", content: result.generation.text });
    }
    pipeline.dispose();

    expect(history).toHaveLength(6);
    expect(history[0]).toEqual({ role: "user", content: "q-1" });
    expect(history[1]?.content).toBe("answer-1");
    expect(history[2]).toEqual({ role: "user", content: "q-2" });
    expect(history[3]?.content).toBe("answer-2");
    expect(history[4]).toEqual({ role: "user", content: "q-3" });
    expect(history[5]?.content).toBe("answer-3");
  });

  it("includes the prior user/assistant messages in the prompt for the next turn", async () => {
    const transport = makeTransport(2);
    const generator = new OpenAIGenerator({ apiKey: "sk-test", transport });
    const pipeline = buildChatPipeline({ embedder: new StubEmbedder(), generator });

    await pipeline.ingest({
      meta: { videoId: "vid-1" as never, title: "T", author: "A", channelId: "UC", lengthSeconds: 0, viewCount: 0, description: "", keywords: [], thumbnails: [], isLiveContent: false },
      lines: [{ text: "alpha", duration: 1, offset: 0, lang: "en" }],
    });

    const history: PromptMessage[] = [
      { role: "user", content: "first" },
      { role: "assistant", content: "first answer" },
    ];
    await pipeline.ask({ query: "follow-up", conversation: { messages: history } });

    const body = JSON.parse(transport.requests[0]!.body);
    // The body has: [system, user("first"), assistant, system, user("follow-up...")]
    const messageRoles = body.messages.map((m: { role: string }) => m.role);
    const userIndices = messageRoles.map((r: string, i: number) => (r === "user" ? i : -1)).filter((i: number) => i >= 0);
    expect(userIndices.length).toBeGreaterThanOrEqual(2);
    // At least one of the user messages must contain "first".
    const hasFirst = body.messages.some((m: { role: string; content: string }) => m.role === "user" && m.content === "first");
    expect(hasFirst).toBe(true);
    // And the last user message must contain "follow-up".
    const last = body.messages[body.messages.length - 1];
    expect(last.role).toBe("user");
    expect(last.content).toContain("follow-up");
    pipeline.dispose();
  });
});
