import { describe, expect, it } from "vitest";
import { JinaEmbedder } from "../src/providers/jina/jina-embedder.js";
import { StubHttpTransport, fail, ok } from "./stub-http-transport.js";

describe("JinaEmbedder", () => {
  it("throws on missing apiKey", () => {
    expect(() => new JinaEmbedder({ apiKey: "" })).toThrow(/apiKey/);
  });

  it("sends a POST to /embeddings", async () => {
    const transport = new StubHttpTransport(
      ok({ data: [{ embedding: [0.1, 0.2] }], model: "jina-embeddings-v3" }),
    );
    const e = new JinaEmbedder({ apiKey: "sk", transport });
    const out = await e.embedMany(["a"]);
    expect(out[0]?.dimensions).toBe(2);
    expect(transport.requests[0]?.url).toBe("https://api.jina.ai/v1/embeddings");
  });

  it("throws on non-2xx", async () => {
    const transport = new StubHttpTransport(fail(500, "oops"));
    const e = new JinaEmbedder({ apiKey: "sk", transport });
    await expect(e.embedMany(["x"])).rejects.toThrow(/500/);
  });

  it("throws on response count mismatch", async () => {
    const transport = new StubHttpTransport(ok({ data: [], model: "jina-embeddings-v3" }));
    const e = new JinaEmbedder({ apiKey: "sk", transport });
    await expect(e.embedMany(["a", "b"])).rejects.toThrow(/count/);
  });

  it("rejects oversized batches", async () => {
    const transport = new StubHttpTransport(ok({ data: [], model: "jina-embeddings-v3" }));
    const e = new JinaEmbedder({ apiKey: "sk", transport, maxBatchSize: 1 });
    await expect(e.embedMany(["a", "b"])).rejects.toThrow(/maxBatchSize/);
  });

  it("respects baseUrl override", async () => {
    const transport = new StubHttpTransport(ok({ data: [{ embedding: [1] }], model: "jina-embeddings-v3" }));
    const e = new JinaEmbedder({ apiKey: "sk", transport, baseUrl: "https://custom.jina.example/v1" });
    await e.embed("x");
    expect(transport.requests[0]?.url).toBe("https://custom.jina.example/v1/embeddings");
  });
});
