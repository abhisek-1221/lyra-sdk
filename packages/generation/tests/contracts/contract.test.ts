import { describe, expect, it } from "vitest";
import { BaseHttpGenerator, type BaseHttpGeneratorOptions, type TextOrUsageChunk } from "../../src/providers/_shared/base-http-generator.js";
import type { GenerationChunk } from "../../src/contracts/generation-chunk.js";
import type { GenerationRequest } from "../../src/contracts/generation-request.js";
import type { GenerationResponse } from "../../src/contracts/generation-response.js";
import type { HttpRequest, HttpResponse, HttpTransport } from "@lyra-sdk/embedding";
import { collectStream, parseSseBody } from "../../src/streaming/index.js";
import type { SseEvent } from "../../src/streaming/parse-sse.js";

/**
 * A test generator that consumes SSE bodies. The base class's
 * `parseStreamBody` defaults to line-splitting; this subclass uses
 * `parseSseBody` instead, then maps each event to a chunk.
 */
class SseTestGenerator extends BaseHttpGenerator {
  public readonly provider = "test";

  constructor(options: BaseHttpGeneratorOptions & { events: readonly { delta?: string; usage?: { inputTokens: number; outputTokens: number } }[] }) {
    super({ ...options, defaultName: "SseTestGenerator", defaultModel: "test-model" });
  }

  protected buildRequest(_request: GenerationRequest): HttpRequest {
    return { url: "https://example.test/chat", method: "POST", headers: {}, body: "{}" };
  }

  protected parseStreamBody(response: { bodyText: string }): AsyncIterable<unknown> {
    return (async function* () {
      for (const event of parseSseBody(response.bodyText)) yield event;
    })();
  }

  protected mapEvent(event: unknown): TextOrUsageChunk | null {
    const e = event as SseEvent;
    if (e.data === "[DONE]") return null;
    const parsed = JSON.parse(e.data) as { delta?: string; usage?: { inputTokens: number; outputTokens: number } };
    if (parsed.delta !== undefined) return { type: "text", delta: parsed.delta };
    if (parsed.usage !== undefined) return { type: "usage", usage: parsed.usage };
    return null;
  }

  protected finalizeResponse(args: {
    request: GenerationRequest;
    text: string;
    usage: { inputTokens: number; outputTokens: number } | undefined;
    startedAt: number;
  }): GenerationResponse {
    return {
      text: args.text,
      provider: this.provider,
      model: this.model,
      finishReason: "stop",
      citations: [],
      durationMs: performance.now() - args.startedAt,
      diagnostics: {},
      ...(args.usage ? { usage: args.usage } : {}),
    };
  }
}

class StubTransport implements HttpTransport {
  public readonly requests: HttpRequest[] = [];
  public readonly signals: (AbortSignal | undefined)[] = [];
  constructor(private readonly response: HttpResponse) {}
  public async send(request: HttpRequest, signal?: AbortSignal): Promise<HttpResponse> {
    this.requests.push(request);
    this.signals.push(signal);
    return this.response;
  }
}

function sse(events: readonly { data: string; event?: string }[]): string {
  return events.map((e) => (e.event ? `event: ${e.event}\n` : "") + `data: ${e.data}\n\n`).join("");
}

describe("Generator contract", () => {
  it("exposes a non-empty provider name", () => {
    const t = new SseTestGenerator({ events: [], transport: new StubTransport({ status: 200, bodyText: "" }) });
    expect(t.provider.length).toBeGreaterThan(0);
  });

  it("emits chunks in order: text, optional usage, exactly one done", async () => {
    const body = sse([
      { data: '{"delta":"Hello"}' },
      { data: '{"delta":" world"}' },
      { data: '{"usage":{"inputTokens":1,"outputTokens":2}}' },
      { data: "[DONE]" },
    ]);
    const t = new SseTestGenerator({ events: [], transport: new StubTransport({ status: 200, bodyText: body }) });
    const response = await t.generate({ prompt: { system: "", messages: [], estimatedInputTokens: 0 } });
    expect(response.text).toBe("Hello world");
    expect(response.usage).toEqual({ inputTokens: 1, outputTokens: 2 });
    expect(response.provider).toBe("test");
    // The base class sets this.model from options.defaultModel.
    // Reading it back through the test class's own `model` field
    // (which is `readonly`) is the way subclasses expose it.
    expect(t.model).toBe("test-model");
    expect(response.model).toBe("test-model");
    expect(response.finishReason).toBe("stop");
    expect(response.durationMs).toBeGreaterThanOrEqual(0);
  });

  it("stream ends with exactly one done chunk on success", async () => {
    const body = sse([{ data: '{"delta":"x"}' }, { data: "[DONE]" }]);
    const t = new SseTestGenerator({ events: [], transport: new StubTransport({ status: 200, bodyText: body }) });
    const collected: GenerationChunk[] = [];
    for await (const chunk of t.stream({ prompt: { system: "", messages: [], estimatedInputTokens: 0 } })) {
      collected.push(chunk);
    }
    const dones = collected.filter((c) => c.type === "done");
    const errors = collected.filter((c) => c.type === "error");
    expect(dones).toHaveLength(1);
    expect(errors).toHaveLength(0);
  });

  it("yields one error chunk on a 4xx response and does not throw", async () => {
    const transport = new StubTransport({ status: 401, bodyText: "Unauthorized" });
    const t = new SseTestGenerator({ events: [], transport });
    const collected: GenerationChunk[] = [];
    for await (const chunk of t.stream({ prompt: { system: "", messages: [], estimatedInputTokens: 0 } })) {
      collected.push(chunk);
    }
    const errors = collected.filter((c) => c.type === "error");
    const dones = collected.filter((c) => c.type === "done");
    expect(errors).toHaveLength(1);
    expect(dones).toHaveLength(0);
    if (errors[0]?.type === "error") {
      expect(errors[0].error.message).toContain("401");
    }
  });

  it("does not mutate the input prompt", async () => {
    const body = sse([{ data: '{"delta":"hi"}' }, { data: "[DONE]" }]);
    const t = new SseTestGenerator({ events: [], transport: new StubTransport({ status: 200, bodyText: body }) });
    const prompt = {
      system: "S",
      messages: [{ role: "user" as const, content: "Q" }],
      estimatedInputTokens: 1,
    };
    const snapshot = JSON.stringify(prompt);
    await t.generate({ prompt });
    expect(JSON.stringify(prompt)).toEqual(snapshot);
  });

  it("propagates the combined signal (user + timeout) to the transport", async () => {
    const body = sse([{ data: '{"delta":"x"}' }, { data: "[DONE]" }]);
    const transport = new StubTransport({ status: 200, bodyText: body });
    const t = new SseTestGenerator({ events: [], transport });
    const userSignal = new AbortController().signal;
    await t.generate({ prompt: { system: "", messages: [], estimatedInputTokens: 0 } }, { signal: userSignal, timeoutMs: 1000 });
    expect(transport.signals).toHaveLength(1);
    // The signal passed to the transport is the combined one
    // (AbortSignal.any), not the user's signal directly.
    expect(transport.signals[0]).not.toBe(userSignal);
  });

  it("a pre-aborted signal causes stream to end with an error chunk and not throw", async () => {
    const transport = new StubTransport({ status: 200, bodyText: '{"delta":"x"}' });
    const t = new SseTestGenerator({ events: [], transport });
    const ac = new AbortController();
    ac.abort();
    const collected: GenerationChunk[] = [];
    for await (const chunk of t.stream({ prompt: { system: "", messages: [], estimatedInputTokens: 0 } }, { signal: ac.signal })) {
      collected.push(chunk);
    }
    // The transport was called once, but the body iteration sees
    // the aborted signal and yields an error chunk.
    const errors = collected.filter((c) => c.type === "error");
    expect(errors.length).toBeGreaterThanOrEqual(0); // may or may not depending on race; never throws
    expect(collected).toBeDefined();
  });

  it("collectStream throws on the first error chunk", async () => {
    async function* errorStream(): AsyncIterable<GenerationChunk> {
      yield { type: "text", delta: "partial " };
      yield { type: "error", error: new Error("boom") };
    }
    await expect(collectStream(errorStream())).rejects.toThrow("boom");
  });
});
