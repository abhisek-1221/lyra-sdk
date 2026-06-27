import { describe, expect, it } from "vitest";
import type { HttpRequest, HttpResponse, HttpTransport } from "@lyra-sdk/embedding";
import { OpenAIGenerator } from "../../../src/providers/openai/index.js";
import type { GenerationChunk } from "../../../src/contracts/generation-chunk.js";

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

describe("OpenAIGenerator", () => {
  it("throws when apiKey is missing", () => {
    expect(() => new OpenAIGenerator({ apiKey: "" })).toThrow(/apiKey/);
  });

  it("builds a POST to /chat/completions with the right headers and body", async () => {
    const transport = new StubTransport({
      status: 200,
      bodyText: sse([{ data: '{"choices":[{"delta":{"content":"hi"}}]}' }, { data: "[DONE]" }]),
    });
    const g = new OpenAIGenerator({ apiKey: "sk-test", transport });
    await g.generate({
      prompt: {
        system: "S",
        messages: [{ role: "user", content: "Q" }],
        estimatedInputTokens: 1,
      },
    });
    expect(transport.requests).toHaveLength(1);
    const req = transport.requests[0]!;
    expect(req.url).toBe("https://api.openai.com/v1/chat/completions");
    expect(req.method).toBe("POST");
    expect(req.headers["authorization"]).toBe("Bearer sk-test");
    expect(req.headers["content-type"]).toBe("application/json");
    const body = JSON.parse(req.body);
    expect(body.model).toBe("gpt-4o-mini");
    expect(body.stream).toBe(true);
    expect(body.stream_options).toEqual({ include_usage: true });
    expect(body.messages[0]).toEqual({ role: "system", content: "S" });
    expect(body.messages[1]).toEqual({ role: "user", content: "Q" });
  });

  it("uses a custom baseUrl", async () => {
    const transport = new StubTransport({
      status: 200,
      bodyText: sse([{ data: '{"choices":[{"delta":{"content":"x"}}]}' }, { data: "[DONE]" }]),
    });
    const g = new OpenAIGenerator({ apiKey: "sk-test", baseUrl: "https://gateway.test/v1", transport });
    await g.generate({ prompt: { system: "", messages: [], estimatedInputTokens: 0 } });
    expect(transport.requests[0]!.url).toBe("https://gateway.test/v1/chat/completions");
  });

  it("uses a custom model", async () => {
    const transport = new StubTransport({
      status: 200,
      bodyText: sse([{ data: '{"choices":[{"delta":{"content":"x"}}]}' }, { data: "[DONE]" }]),
    });
    const g = new OpenAIGenerator({ apiKey: "sk-test", model: "gpt-4o", transport });
    await g.generate({ prompt: { system: "", messages: [], estimatedInputTokens: 0 } });
    const body = JSON.parse(transport.requests[0]!.body);
    expect(body.model).toBe("gpt-4o");
  });

  it("assembles a complete GenerationResponse with provider, model, and finishReason", async () => {
    const transport = new StubTransport({
      status: 200,
      bodyText: sse([
        { data: '{"choices":[{"delta":{"content":"Hello"}}]}' },
        { data: '{"choices":[{"delta":{"content":" world"}}]}' },
        { data: '{"choices":[{"delta":{},"finish_reason":"stop"}],"usage":{"prompt_tokens":1,"completion_tokens":2}}' },
        { data: "[DONE]" },
      ]),
    });
    const g = new OpenAIGenerator({ apiKey: "sk-test", transport });
    const resp = await g.generate({ prompt: { system: "", messages: [], estimatedInputTokens: 0 } });
    expect(resp.text).toBe("Hello world");
    expect(resp.provider).toBe("openai");
    expect(resp.model).toBe("gpt-4o-mini");
    expect(resp.finishReason).toBe("stop");
    expect(resp.usage).toEqual({ inputTokens: 1, outputTokens: 2 });
  });

  it("emits a single error chunk on a 4xx response and does not throw", async () => {
    const transport = new StubTransport({ status: 401, bodyText: "Unauthorized" });
    const g = new OpenAIGenerator({ apiKey: "sk-test", transport });
    const collected: GenerationChunk[] = [];
    for await (const c of g.stream({ prompt: { system: "", messages: [], estimatedInputTokens: 0 } })) {
      collected.push(c);
    }
    const errors = collected.filter((c) => c.type === "error");
    const dones = collected.filter((c) => c.type === "done");
    expect(errors).toHaveLength(1);
    expect(dones).toHaveLength(0);
    if (errors[0]?.type === "error") {
      expect(errors[0].error.message).toContain("401");
    }
  });

  it("forwards per-request options into the body", async () => {
    const transport = new StubTransport({
      status: 200,
      bodyText: sse([{ data: '{"choices":[{"delta":{"content":"x"}}]}' }, { data: "[DONE]" }]),
    });
    const g = new OpenAIGenerator({ apiKey: "sk-test", transport });
    await g.generate(
      { prompt: { system: "", messages: [], estimatedInputTokens: 0 } },
      { temperature: 0.7, maxOutputTokens: 256, stopSequences: ["END"] },
    );
    const body = JSON.parse(transport.requests[0]!.body);
    expect(body.temperature).toBe(0.7);
    expect(body.max_tokens).toBe(256);
    expect(body.stop).toEqual(["END"]);
  });

  it("emits a structured-output response_format when prompt.schema is set", async () => {
    const transport = new StubTransport({
      status: 200,
      bodyText: sse([
        { data: '{"choices":[{"delta":{"content":"{\\"a\\":1}"}}]}' },
        { data: "[DONE]" },
      ]),
    });
    const g = new OpenAIGenerator({ apiKey: "sk-test", transport });
    const resp = await g.generate<{ a: number }>({
      prompt: {
        system: "",
        messages: [],
        estimatedInputTokens: 0,
        schema: { type: "object", title: "Output", properties: { a: { type: "number" } } },
      },
    });
    const body = JSON.parse(transport.requests[0]!.body);
    expect(body.response_format).toEqual({
      type: "json_schema",
      json_schema: { name: "Output", schema: { type: "object", title: "Output", properties: { a: { type: "number" } } }, strict: true },
    });
    expect(resp.data).toEqual({ a: 1 });
  });
});
