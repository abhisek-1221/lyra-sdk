import { describe, expect, it } from "vitest";
import { OllamaEmbedder } from "../src/providers/ollama/ollama-embedder.js";
import { StubHttpTransport, fail, ok } from "./stub-http-transport.js";

describe("OllamaEmbedder", () => {
  it("throws on missing model", () => {
    expect(() => new OllamaEmbedder({ model: "" })).toThrow(/model/);
  });

  it("sends a POST to /api/embed", async () => {
    const transport = new StubHttpTransport(
      ok({ embeddings: [{ embedding: [0.1, 0.2] }, { embedding: [0.3, 0.4] }] }),
    );
    const e = new OllamaEmbedder({ model: "nomic-embed-text", transport });
    const out = await e.embedMany(["a", "b"]);
    expect(out.length).toBe(2);
    expect(transport.requests[0]?.url).toBe("http://localhost:11434/api/embed");
    expect(JSON.parse(transport.requests[0]?.body ?? "{}")).toEqual({
      model: "nomic-embed-text",
      input: ["a", "b"],
    });
  });

  it("accepts the legacy single-embedding response shape", async () => {
    const transport = new StubHttpTransport(ok({ embedding: [0.1, 0.2, 0.3] }));
    const e = new OllamaEmbedder({ model: "m", transport });
    const out = await e.embedMany(["x"]);
    expect(out[0]?.vector.length).toBe(3);
  });

  it("throws when the count of returned embeddings does not match the input count", async () => {
    const transport = new StubHttpTransport(ok({ embeddings: [{ embedding: [1, 2] }] }));
    const e = new OllamaEmbedder({ model: "m", transport });
    await expect(e.embedMany(["a", "b"])).rejects.toThrow(/returned 1 embeddings for 2 inputs/);
  });

  it("throws on non-2xx", async () => {
    const transport = new StubHttpTransport(fail(500, "internal error"));
    const e = new OllamaEmbedder({ model: "m", transport });
    await expect(e.embedMany(["x"])).rejects.toThrow(/500/);
  });

  it("respects baseUrl override", async () => {
    const transport = new StubHttpTransport(ok({ embedding: [1, 2] }));
    const e = new OllamaEmbedder({ model: "m", transport, baseUrl: "http://gpu-host:11434" });
    await e.embed("x");
    expect(transport.requests[0]?.url).toBe("http://gpu-host:11434/api/embed");
  });
});
