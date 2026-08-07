import { describe, expect, it } from "vitest";
import { collectStream, parseNdjsonBody, parseSseBody, withTimeout } from "../../src/streaming/index.js";

describe("withTimeout", () => {
  it("returns undefined when both signal and timeout are absent", () => {
    expect(withTimeout(undefined, undefined)).toBeUndefined();
  });

  it("returns the user signal when only signal is supplied", () => {
    const s = new AbortController().signal;
    expect(withTimeout(s, undefined)).toBe(s);
  });

  it("returns a timeout signal when only timeout is supplied", () => {
    const s = withTimeout(undefined, 60_000);
    expect(s).toBeDefined();
    expect(s?.aborted).toBe(false);
  });

  it("combines the user signal and timeout with AbortSignal.any", () => {
    const user = new AbortController();
    const combined = withTimeout(user.signal, 60_000);
    expect(combined).toBeDefined();
    expect(combined).not.toBe(user.signal);
    user.abort();
    expect(combined?.aborted).toBe(true);
  });
});

describe("parseSseBody", () => {
  it("parses a single message event", () => {
    const body = "data: hello\n\n";
    const events = [...parseSseBody(body)];
    expect(events).toEqual([{ event: "message", data: "hello" }]);
  });

  it("parses multiple events", () => {
    const body = "data: a\n\ndata: b\n\n";
    const events = [...parseSseBody(body)];
    expect(events).toEqual([
      { event: "message", data: "a" },
      { event: "message", data: "b" },
    ]);
  });

  it("preserves the event name", () => {
    const body = "event: ping\ndata: hi\n\n";
    const events = [...parseSseBody(body)];
    expect(events).toEqual([{ event: "ping", data: "hi" }]);
  });

  it("joins multi-line data fields with newlines", () => {
    const body = "data: line1\ndata: line2\n\n";
    const events = [...parseSseBody(body)];
    expect(events).toEqual([{ event: "message", data: "line1\nline2" }]);
  });

  it("skips comment lines starting with colon", () => {
    const body = ": this is a comment\ndata: hi\n\n";
    const events = [...parseSseBody(body)];
    expect(events).toEqual([{ event: "message", data: "hi" }]);
  });

  it("handles CR-LF line endings", () => {
    const body = "data: hi\r\n\r\n";
    const events = [...parseSseBody(body)];
    expect(events).toEqual([{ event: "message", data: "hi" }]);
  });

  it("handles [DONE] sentinel", () => {
    const body = "data: [DONE]\n\n";
    const events = [...parseSseBody(body)];
    expect(events).toEqual([{ event: "message", data: "[DONE]" }]);
  });
});

describe("parseNdjsonBody", () => {
  it("parses line-delimited JSON", () => {
    const body = '{"a":1}\n{"a":2}\n{"a":3}\n';
    const events = [...parseNdjsonBody<{ a: number }>(body)];
    expect(events).toEqual([{ a: 1 }, { a: 2 }, { a: 3 }]);
  });

  it("skips blank lines", () => {
    const body = '{"a":1}\n\n\n{"a":2}\n';
    const events = [...parseNdjsonBody<{ a: number }>(body)];
    expect(events).toEqual([{ a: 1 }, { a: 2 }]);
  });

  it("returns an empty iterator for an empty body", () => {
    expect([...parseNdjsonBody("")]).toEqual([]);
  });
});

describe("collectStream", () => {
  it("concatenates text deltas into a single string", async () => {
    async function* stream() {
      yield { type: "text", delta: "a" };
      yield { type: "text", delta: "b" };
      yield { type: "text", delta: "c" };
      yield {
        type: "done",
        response: {
          text: "",
          provider: "p",
          model: "m",
          finishReason: "stop",
          citations: [],
          durationMs: 0,
          diagnostics: {},
        },
      };
    }
    const response = await collectStream(stream());
    expect(response.text).toBe("abc");
  });

  it("applies the optional usage chunk", async () => {
    async function* stream() {
      yield { type: "usage", usage: { inputTokens: 1, outputTokens: 2 } };
      yield {
        type: "done",
        response: {
          text: "x",
          provider: "p",
          model: "m",
          finishReason: "stop",
          citations: [],
          durationMs: 0,
          diagnostics: {},
        },
      };
    }
    const response = await collectStream(stream());
    expect(response.usage).toEqual({ inputTokens: 1, outputTokens: 2 });
  });

  it("throws on the first error chunk", async () => {
    async function* stream() {
      yield { type: "text", delta: "x" };
      yield { type: "error", error: new Error("boom") };
    }
    await expect(collectStream(stream())).rejects.toThrow("boom");
  });

  it("throws if the stream ends without a done chunk", async () => {
    async function* stream() {
      yield { type: "text", delta: "x" };
    }
    await expect(collectStream(stream())).rejects.toThrow("done");
  });
});
