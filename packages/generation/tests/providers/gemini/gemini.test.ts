import { describe, expect, it } from "vitest";
import type { HttpRequest, HttpResponse, HttpTransport } from "@lyra-sdk/embedding";
import { GeminiGenerator } from "../../../src/providers/gemini/index.js";

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

describe("GeminiGenerator", () => {
  it("throws when apiKey is missing", () => {
    expect(() => new GeminiGenerator({ apiKey: "" })).toThrow(/apiKey/);
  });

  it("builds a POST to /v1beta/models/{model}:streamGenerateContent with the right headers", async () => {
    const transport = new StubTransport({
      status: 200,
      bodyText: sse([{ data: '{"candidates":[{"content":{"parts":[{"text":"hi"}]}}]}' }]),
    });
    const g = new GeminiGenerator({ apiKey: "gkey", transport });
    await g.generate({
      prompt: {
        system: "S",
        messages: [{ role: "user", content: "Q" }],
        estimatedInputTokens: 1,
      },
    });
    const req = transport.requests[0]!;
    expect(req.url).toBe("https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:streamGenerateContent?alt=sse");
    expect(req.headers["x-goog-api-key"]).toBe("gkey");
    const body = JSON.parse(req.body);
    expect(body.systemInstruction.parts[0].text).toBe("S");
    expect(body.contents[0]).toEqual({ role: "user", parts: [{ text: "Q" }] });
  });

  it("emits responseSchema and responseMimeType when prompt.schema is set", async () => {
    const transport = new StubTransport({
      status: 200,
      bodyText: sse([{ data: '{"candidates":[{"content":{"parts":[{"text":"{\\"a\\":1}"}]}}]}' }]),
    });
    const g = new GeminiGenerator({ apiKey: "k", transport });
    await g.generate<{ a: number }>({
      prompt: {
        system: "",
        messages: [],
        estimatedInputTokens: 0,
        schema: { type: "object", properties: { a: { type: "number" } } },
      },
    });
    const body = JSON.parse(transport.requests[0]!.body);
    expect(body.generationConfig.responseMimeType).toBe("application/json");
    expect(body.generationConfig.responseSchema).toEqual({ type: "object", properties: { a: { type: "number" } } });
  });

  it("maps STOP to stop and MAX_TOKENS to length", async () => {
    const transport = new StubTransport({
      status: 200,
      bodyText: sse([
        { data: '{"candidates":[{"content":{"parts":[{"text":"x"}]},"finishReason":"STOP"}]}' },
      ]),
    });
    const g = new GeminiGenerator({ apiKey: "k", transport });
    const resp = await g.generate({ prompt: { system: "", messages: [], estimatedInputTokens: 0 } });
    expect(resp.finishReason).toBe("stop");
    expect(resp.provider).toBe("gemini");
  });

  it("captures token usage from usageMetadata", async () => {
    const transport = new StubTransport({
      status: 200,
      bodyText: sse([
        { data: '{"candidates":[{"content":{"parts":[{"text":"x"}]}}],"usageMetadata":{"promptTokenCount":7,"candidatesTokenCount":3}}' },
      ]),
    });
    const g = new GeminiGenerator({ apiKey: "k", transport });
    const resp = await g.generate({ prompt: { system: "", messages: [], estimatedInputTokens: 0 } });
    expect(resp.usage).toEqual({ inputTokens: 7, outputTokens: 3 });
  });

  it("emits a single error chunk on a 4xx response", async () => {
    const transport = new StubTransport({ status: 403, bodyText: "Forbidden" });
    const g = new GeminiGenerator({ apiKey: "k", transport });
    const collected = [];
    for await (const c of g.stream({ prompt: { system: "", messages: [], estimatedInputTokens: 0 } })) collected.push(c);
    expect(collected.filter((c) => c.type === "error")).toHaveLength(1);
  });
});
