import { describe, expect, it } from "vitest";
import type { HttpRequest, HttpResponse, HttpTransport } from "@lyra-sdk/embedding";
import { OpenRouterGenerator } from "../../../src/providers/openrouter/index.js";

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

describe("OpenRouterGenerator", () => {
  it("throws when apiKey is missing", () => {
    expect(() => new OpenRouterGenerator({ apiKey: "" })).toThrow(/apiKey/);
  });

  it("builds a POST to /chat/completions on openrouter.ai with the right headers", async () => {
    const transport = new StubTransport({
      status: 200,
      bodyText: sse([{ data: '{"choices":[{"delta":{"content":"hi"}}]}' }, { data: "[DONE]" }]),
    });
    const g = new OpenRouterGenerator({ apiKey: "or-key", transport });
    await g.generate({
      prompt: { system: "", messages: [{ role: "user", content: "Q" }], estimatedInputTokens: 1 },
    });
    const req = transport.requests[0]!;
    expect(req.url).toBe("https://openrouter.ai/api/v1/chat/completions");
    expect(req.headers["authorization"]).toBe("Bearer or-key");
    const body = JSON.parse(req.body);
    expect(body.model).toBe("anthropic/claude-3.5-sonnet");
    expect(body.stream).toBe(true);
  });

  it("uses a custom baseUrl", async () => {
    const transport = new StubTransport({
      status: 200,
      bodyText: sse([{ data: '{"choices":[{"delta":{"content":"x"}}]}' }, { data: "[DONE]" }]),
    });
    const g = new OpenRouterGenerator({ apiKey: "k", baseUrl: "https://proxy.test/api/v1", transport });
    await g.generate({ prompt: { system: "", messages: [], estimatedInputTokens: 0 } });
    expect(transport.requests[0]!.url).toBe("https://proxy.test/api/v1/chat/completions");
  });

  it("emits appReferer and appTitle headers when supplied", async () => {
    const transport = new StubTransport({
      status: 200,
      bodyText: sse([{ data: '{"choices":[{"delta":{"content":"x"}}]}' }, { data: "[DONE]" }]),
    });
    const g = new OpenRouterGenerator({ apiKey: "k", appReferer: "https://myapp.test", appTitle: "My App", transport });
    await g.generate({ prompt: { system: "", messages: [], estimatedInputTokens: 0 } });
    expect(transport.requests[0]!.headers["HTTP-Referer"]).toBe("https://myapp.test");
    expect(transport.requests[0]!.headers["X-Title"]).toBe("My App");
  });

  it("emits a single error chunk on a 4xx response", async () => {
    const transport = new StubTransport({ status: 401, bodyText: "Unauthorized" });
    const g = new OpenRouterGenerator({ apiKey: "k", transport });
    const collected = [];
    for await (const c of g.stream({ prompt: { system: "", messages: [], estimatedInputTokens: 0 } })) collected.push(c);
    expect(collected.filter((c) => c.type === "error")).toHaveLength(1);
  });

  it("propagates provider=openrouter and finishReason=stop from the wire format", async () => {
    const transport = new StubTransport({
      status: 200,
      bodyText: sse([
        { data: '{"choices":[{"delta":{"content":"x"}}]}' },
        { data: '{"choices":[{"delta":{},"finish_reason":"stop"}]}' },
        { data: "[DONE]" },
      ]),
    });
    const g = new OpenRouterGenerator({ apiKey: "k", transport });
    const resp = await g.generate({ prompt: { system: "", messages: [], estimatedInputTokens: 0 } });
    expect(resp.provider).toBe("openrouter");
    expect(resp.finishReason).toBe("stop");
  });
});
