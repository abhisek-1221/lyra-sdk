import { describe, expect, it } from "vitest";
import type { Embedding, Embedder } from "@lyra-sdk/embedding";
import type { HttpRequest, HttpResponse, HttpTransport } from "@lyra-sdk/embedding";
import { OpenAIGenerator, type JSONSchema } from "@lyra-sdk/generation";
import type { Prompt } from "@lyra-sdk/generation";

class StubEmbedder implements Embedder {
  async embed(_input: string): Promise<Embedding> {
    return { id: "e" as never, vector: new Float32Array([0.5, 0.5]), model: "m", dimensions: 2 };
  }
  async embedMany(inputs: readonly string[]): Promise<readonly Embedding[]> {
    return inputs.map(() => ({ id: "e" as never, vector: new Float32Array([0.5, 0.5]), model: "m", dimensions: 2 }));
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

interface Person {
  name: string;
  age: number;
}

describe("apps/structured-output", () => {
  it("returns a typed data field from a schema-constrained prompt", async () => {
    const transport = new StubTransport({
      status: 200,
      bodyText: sse([{ data: '{"choices":[{"delta":{"content":"{\\"name\\":\\"Alice\\",\\"age\\":30}"}}]}' }, { data: "[DONE]" }]),
    });
    const generator = new OpenAIGenerator({ apiKey: "sk-test", transport });

    const schema: JSONSchema = {
      type: "object",
      title: "Person",
      properties: { name: { type: "string" }, age: { type: "number" } },
      required: ["name", "age"],
    };
    const prompt: Prompt = {
      system: "Extract the person.",
      messages: [{ role: "user", content: "Alice is 30 years old." }],
      estimatedInputTokens: 0,
      schema,
    };
    const response = await generator.generate<Person>({ prompt });
    const body = JSON.parse(transport.requests[0]!.body);
    expect(body.response_format).toEqual({
      type: "json_schema",
      json_schema: { name: "Person", schema, strict: true },
    });
    expect(response.data).toEqual({ name: "Alice", age: 30 });
  });

  it("returns finishReason=error when JSON parsing fails", async () => {
    const transport = new StubTransport({
      status: 200,
      bodyText: sse([{ data: '{"choices":[{"delta":{"content":"not json"}}]}' }, { data: "[DONE]" }]),
    });
    const generator = new OpenAIGenerator({ apiKey: "sk-test", transport });
    const response = await generator.generate({
      prompt: {
        system: "S",
        messages: [{ role: "user", content: "Q" }],
        estimatedInputTokens: 0,
        schema: { type: "object" },
      },
    });
    expect(response.finishReason).toBe("error");
    expect(response.data).toBeUndefined();
    expect(response.diagnostics.parseError).toBeDefined();
    void new StubEmbedder();
  });
});
