import { describe, expect, it } from "vitest";
import { OpenAIEmbedder } from "../src/providers/openai/openai-embedder.js";
import { StubHttpTransport, fail, ok } from "./stub-http-transport.js";

describe("OpenAIEmbedder", () => {
  it("throws on missing apiKey", () => {
    expect(() => new OpenAIEmbedder({ apiKey: "" })).toThrow(/apiKey/);
  });

  it("sends a POST to /embeddings with the expected headers and body", async () => {
    const transport = new StubHttpTransport((req) => {
      if (req.url.endsWith("/embeddings")) {
        return ok({
          data: [
            { index: 0, embedding: [0.1, 0.2, 0.3] },
            { index: 1, embedding: [0.4, 0.5, 0.6] },
          ],
          model: "text-embedding-3-small",
        });
      }
      return fail(404, {});
    });
    const e = new OpenAIEmbedder({ apiKey: "sk-test", transport });
    const out = await e.embedMany(["hello", "world"]);
    expect(out.length).toBe(2);
    expect(transport.requests[0]?.method).toBe("POST");
    expect(transport.requests[0]?.url).toBe("https://api.openai.com/v1/embeddings");
    expect(transport.requests[0]?.headers.authorization).toBe("Bearer sk-test");
    expect(JSON.parse(transport.requests[0]?.body ?? "{}")).toEqual({
      model: "text-embedding-3-small",
      input: ["hello", "world"],
    });
  });

  it("returns embeddings in input order even if provider reorders", async () => {
    const transport = new StubHttpTransport(
      ok({
        data: [
          { index: 1, embedding: [9, 9, 9] },
          { index: 0, embedding: [1, 1, 1] },
        ],
        model: "text-embedding-3-small",
      }),
    );
    const e = new OpenAIEmbedder({ apiKey: "sk", transport });
    const out = await e.embedMany(["a", "b"]);
    expect([...(out[0]?.vector ?? [])]).toEqual([1, 1, 1]);
    expect([...(out[1]?.vector ?? [])]).toEqual([9, 9, 9]);
  });

  it("returns Float32Array vectors with the correct dimensions", async () => {
    const transport = new StubHttpTransport(
      ok({ data: [{ index: 0, embedding: [0.1, 0.2, 0.3, 0.4] }], model: "m" }),
    );
    const e = new OpenAIEmbedder({ apiKey: "sk", transport });
    const out = await e.embedMany(["x"]);
    expect(out[0]?.vector).toBeInstanceOf(Float32Array);
    expect(out[0]?.dimensions).toBe(4);
  });

  it("throws KernelError(upstream) on non-2xx", async () => {
    const transport = new StubHttpTransport(fail(401, { error: "bad key" }));
    const e = new OpenAIEmbedder({ apiKey: "sk", transport });
    await expect(e.embedMany(["x"])).rejects.toThrow(/401/);
  });

  it("throws on non-JSON response", async () => {
    const transport = new StubHttpTransport({ status: 200, bodyText: "not json" });
    const e = new OpenAIEmbedder({ apiKey: "sk", transport });
    await expect(e.embedMany(["x"])).rejects.toThrow(/non-JSON/);
  });

  it("embed is a one-element batch", async () => {
    const transport = new StubHttpTransport(
      ok({ data: [{ index: 0, embedding: [1, 2, 3] }], model: "m" }),
    );
    const e = new OpenAIEmbedder({ apiKey: "sk", transport });
    const out = await e.embed("hi");
    expect(out.vector.length).toBe(3);
    expect(transport.requests[0]?.body).toContain('"input":["hi"]');
  });

  it("rejects oversized batches", async () => {
    const transport = new StubHttpTransport(ok({ data: [], model: "m" }));
    const e = new OpenAIEmbedder({ apiKey: "sk", transport, maxBatchSize: 2 });
    await expect(e.embedMany(["a", "b", "c"])).rejects.toThrow(/maxBatchSize/);
  });

  it("rejects empty input", async () => {
    const transport = new StubHttpTransport(ok({ data: [], model: "m" }));
    const e = new OpenAIEmbedder({ apiKey: "sk", transport });
    expect(await e.embedMany([])).toEqual([]);
  });
});
