import { describe, expect, it } from "vitest";
import type { HttpRequest, HttpResponse, HttpTransport } from "@lyra-sdk/embedding";
import { AnthropicGenerator } from "../../../src/providers/anthropic/index.js";

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

describe("AnthropicGenerator", () => {
  it("throws when apiKey is missing", () => {
    expect(() => new AnthropicGenerator({ apiKey: "" })).toThrow(/apiKey/);
  });

  it("builds a POST to /v1/messages with the right headers and body", async () => {
    const transport = new StubTransport({
      status: 200,
      bodyText: sse([
        { data: '{"type":"content_block_delta","delta":{"type":"text_delta","text":"hi"}}' },
        { data: '{"type":"message_stop"}' },
      ]),
    });
    const g = new AnthropicGenerator({ apiKey: "sk-ant", transport });
    await g.generate({
      prompt: {
        system: "S",
        messages: [{ role: "user", content: "Q" }],
        estimatedInputTokens: 1,
      },
    });
    const req = transport.requests[0]!;
    expect(req.url).toBe("https://api.anthropic.com/v1/messages");
    expect(req.method).toBe("POST");
    expect(req.headers["x-api-key"]).toBe("sk-ant");
    expect(req.headers["anthropic-version"]).toBe("2023-06-01");
    const body = JSON.parse(req.body);
    expect(body.model).toBe("claude-3-5-sonnet-latest");
    expect(body.system).toBe("S");
    expect(body.messages[0]).toEqual({ role: "user", content: "Q" });
    expect(body.max_tokens).toBe(1024);
    expect(body.stream).toBe(true);
  });

  it("uses a custom model and baseUrl", async () => {
    const transport = new StubTransport({
      status: 200,
      bodyText: sse([{ data: '{"type":"content_block_delta","delta":{"type":"text_delta","text":"x"}}' }, { data: '{"type":"message_stop"}' }]),
    });
    const g = new AnthropicGenerator({ apiKey: "k", model: "claude-3-opus", baseUrl: "https://proxy.test", transport });
    await g.generate({ prompt: { system: "", messages: [], estimatedInputTokens: 0 } });
    expect(transport.requests[0]!.url).toBe("https://proxy.test/v1/messages");
    const body = JSON.parse(transport.requests[0]!.body);
    expect(body.model).toBe("claude-3-opus");
  });

  it("maps end_turn to stop, max_tokens to length", async () => {
    const transport = new StubTransport({
      status: 200,
      bodyText: sse([
        { data: '{"type":"content_block_delta","delta":{"type":"text_delta","text":"x"}}' },
        { data: '{"type":"message_delta","delta":{"stop_reason":"end_turn"}}' },
        { data: '{"type":"message_stop"}' },
      ]),
    });
    const g = new AnthropicGenerator({ apiKey: "k", transport });
    const resp = await g.generate({ prompt: { system: "", messages: [], estimatedInputTokens: 0 } });
    expect(resp.finishReason).toBe("stop");
    expect(resp.provider).toBe("anthropic");
  });

  it("captures input/output tokens from message_start and message_delta", async () => {
    const transport = new StubTransport({
      status: 200,
      bodyText: sse([
        { data: '{"type":"message_start","message":{"usage":{"input_tokens":3}}}' },
        { data: '{"type":"content_block_delta","delta":{"type":"text_delta","text":"x"}}' },
        { data: '{"type":"message_delta","delta":{"stop_reason":"end_turn"},"usage":{"output_tokens":5}}' },
        { data: '{"type":"message_stop"}' },
      ]),
    });
    const g = new AnthropicGenerator({ apiKey: "k", transport });
    const resp = await g.generate({ prompt: { system: "", messages: [], estimatedInputTokens: 0 } });
    expect(resp.usage).toEqual({ inputTokens: 3, outputTokens: 5 });
  });

  it("emits a single error chunk on a 4xx response", async () => {
    const transport = new StubTransport({ status: 401, bodyText: "Unauthorized" });
    const g = new AnthropicGenerator({ apiKey: "k", transport });
    const collected = [];
    for await (const c of g.stream({ prompt: { system: "", messages: [], estimatedInputTokens: 0 } })) collected.push(c);
    const errors = collected.filter((c) => c.type === "error");
    expect(errors).toHaveLength(1);
  });
});
