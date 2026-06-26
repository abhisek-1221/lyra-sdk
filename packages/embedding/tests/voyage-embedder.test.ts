import { describe, expect, it } from "vitest";
import { VoyageEmbedder } from "../src/providers/voyage/voyage-embedder.js";
import { StubHttpTransport, fail, ok } from "./stub-http-transport.js";

describe("VoyageEmbedder", () => {
  it("throws on missing apiKey", () => {
    expect(() => new VoyageEmbedder({ apiKey: "" })).toThrow(/apiKey/);
  });

  it("sends a POST to /embeddings with the expected shape", async () => {
    const transport = new StubHttpTransport(
      ok({ data: [{ embedding: [0.1, 0.2] }, { embedding: [0.3, 0.4] }], model: "voyage-3" }),
    );
    const e = new VoyageEmbedder({ apiKey: "sk", transport });
    const out = await e.embedMany(["a", "b"]);
    expect(out.length).toBe(2);
    expect(transport.requests[0]?.url).toBe("https://api.voyageai.com/v1/embeddings");
    expect(JSON.parse(transport.requests[0]?.body ?? "{}").input).toEqual(["a", "b"]);
  });

  it("returns Float32Array vectors with the correct dimensions", async () => {
    const transport = new StubHttpTransport(
      ok({ data: [{ embedding: [1, 2, 3, 4] }], model: "voyage-3" }),
    );
    const e = new VoyageEmbedder({ apiKey: "sk", transport });
    const out = await e.embed("x");
    expect(out.vector).toBeInstanceOf(Float32Array);
    expect(out.dimensions).toBe(4);
  });

  it("throws on non-2xx", async () => {
    const transport = new StubHttpTransport(fail(401, { error: "bad key" }));
    const e = new VoyageEmbedder({ apiKey: "sk", transport });
    await expect(e.embedMany(["x"])).rejects.toThrow(/401/);
  });

  it("respects maxBatchSize", async () => {
    const transport = new StubHttpTransport(ok({ data: [], model: "voyage-3" }));
    const e = new VoyageEmbedder({ apiKey: "sk", transport, maxBatchSize: 2 });
    await expect(e.embedMany(["a", "b", "c"])).rejects.toThrow(/maxBatchSize/);
  });

  it("throws on response count mismatch", async () => {
    const transport = new StubHttpTransport(ok({ data: [{ embedding: [1] }], model: "voyage-3" }));
    const e = new VoyageEmbedder({ apiKey: "sk", transport });
    await expect(e.embedMany(["a", "b"])).rejects.toThrow(/count/);
  });
});
