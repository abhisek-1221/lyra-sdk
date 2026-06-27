import { describe, expect, it } from "vitest";
import type { HttpRequest, HttpResponse, HttpTransport } from "@lyra-sdk/embedding";
import { OllamaGenerator } from "../../../src/providers/ollama/index.js";

class StubTransport implements HttpTransport {
  public readonly requests: HttpRequest[] = [];
  constructor(private readonly response: HttpResponse) {}
  public async send(request: HttpRequest): Promise<HttpResponse> {
    this.requests.push(request);
    return this.response;
  }
}

function ndjson(lines: readonly object[]): string {
  return lines.map((l) => JSON.stringify(l)).join("\n") + "\n";
}

describe("OllamaGenerator", () => {
  it("throws when model is missing", () => {
    expect(() => new OllamaGenerator({ model: "" })).toThrow(/model/);
  });

  it("builds a POST to /api/chat on localhost:11434 with no auth headers", async () => {
    const transport = new StubTransport({
      status: 200,
      bodyText: ndjson([
        { message: { role: "assistant", content: "Hello" } },
        { message: { role: "assistant", content: " world" }, done: true, done_reason: "stop" },
      ]),
    });
    const g = new OllamaGenerator({ model: "llama3.1", transport });
    await g.generate({
      prompt: {
        system: "S",
        messages: [{ role: "user", content: "Q" }],
        estimatedInputTokens: 1,
      },
    });
    const req = transport.requests[0]!;
    expect(req.url).toBe("http://localhost:11434/api/chat");
    expect(req.headers["authorization"]).toBeUndefined();
    const body = JSON.parse(req.body);
    expect(body.model).toBe("llama3.1");
    expect(body.stream).toBe(true);
    expect(body.messages[0]).toEqual({ role: "system", content: "S" });
    expect(body.messages[1]).toEqual({ role: "user", content: "Q" });
  });

  it("uses a custom baseUrl", async () => {
    const transport = new StubTransport({
      status: 200,
      bodyText: ndjson([{ message: { role: "assistant", content: "x" }, done: true, done_reason: "stop" }]),
    });
    const g = new OllamaGenerator({ model: "llama3.1", baseUrl: "http://gpu-host.lan:11434", transport });
    await g.generate({ prompt: { system: "", messages: [], estimatedInputTokens: 0 } });
    expect(transport.requests[0]!.url).toBe("http://gpu-host.lan:11434/api/chat");
  });

  it("emits the `format` field when prompt.schema is set", async () => {
    const transport = new StubTransport({
      status: 200,
      bodyText: ndjson([{ message: { role: "assistant", content: "{\"a\":1}" }, done: true, done_reason: "stop" }]),
    });
    const g = new OllamaGenerator({ model: "llama3.1", transport });
    await g.generate<{ a: number }>({
      prompt: {
        system: "",
        messages: [],
        estimatedInputTokens: 0,
        schema: { type: "object", properties: { a: { type: "number" } } },
      },
    });
    const body = JSON.parse(transport.requests[0]!.body);
    expect(body.format).toEqual({ type: "object", properties: { a: { type: "number" } } });
  });

  it("captures token usage from the final done chunk", async () => {
    const transport = new StubTransport({
      status: 200,
      bodyText: ndjson([
        { message: { role: "assistant", content: "x" }, prompt_eval_count: 4, eval_count: 2, done: true, done_reason: "stop" },
      ]),
    });
    const g = new OllamaGenerator({ model: "llama3.1", transport });
    const resp = await g.generate({ prompt: { system: "", messages: [], estimatedInputTokens: 0 } });
    expect(resp.usage).toEqual({ inputTokens: 4, outputTokens: 2 });
  });

  it("emits a single error chunk on a 4xx response", async () => {
    const transport = new StubTransport({ status: 404, bodyText: "model not found" });
    const g = new OllamaGenerator({ model: "missing", transport });
    const collected = [];
    for await (const c of g.stream({ prompt: { system: "", messages: [], estimatedInputTokens: 0 } })) collected.push(c);
    expect(collected.filter((c) => c.type === "error")).toHaveLength(1);
  });
});
