import { createChunkId, createDocumentId, KernelError } from "@lyra-sdk/kernel";
import type { HttpRequest, HttpResponse, HttpTransport } from "@lyra-sdk/embedding";
import type { ScoredChunk } from "@lyra-sdk/retrieval";
import type { Chunk } from "@lyra-sdk/storage";
import { describe, expect, it } from "vitest";
import { JinaReranker } from "../../src/cross-encoder/providers/jina/index.js";
import { VoyageReranker } from "../../src/cross-encoder/providers/voyage/index.js";
import { CohereReranker } from "../../src/cross-encoder/providers/cohere/index.js";
import { BGEReranker } from "../../src/cross-encoder/providers/bge/index.js";

class StubTransport implements HttpTransport {
  public captured: HttpRequest[] = [];
  constructor(
    private readonly responder: (req: HttpRequest) => HttpResponse | Promise<HttpResponse>,
  ) {}
  async send(req: HttpRequest): Promise<HttpResponse> {
    this.captured.push(req);
    return this.responder(req);
  }
}

function jsonResponse(body: unknown, status = 200): HttpResponse {
  return { status, bodyText: JSON.stringify(body) };
}

function makeChunk(id: string): Chunk {
  return {
    id: createChunkId(id),
    documentId: createDocumentId(`doc-${id}`),
    span: { start: 0, end: 1 },
    metadata: {},
  };
}

function scored(id: string, score: number): ScoredChunk {
  return { chunk: makeChunk(id), score };
}

const baseOpts = {
  apiKey: "key",
  batchSize: 100,
  concurrency: 1,
};

describe("JinaReranker", () => {
  it("uses default base url and /v1/rerank endpoint", async () => {
    const transport = new StubTransport(() =>
      jsonResponse({ results: [{ index: 0, relevance_score: 0.9 }] }),
    );
    const r = new JinaReranker({ ...baseOpts, model: "jina-reranker-v2", transport });
    await r.rerank("q", [scored("a", 0.5)], { texts: ["t"] });
    const sent = transport.captured[0]!;
    expect(sent.url).toBe("https://api.jina.ai/v1/rerank");
  });

  it("sends model, query, documents, top_n in the body", async () => {
    const transport = new StubTransport(() =>
      jsonResponse({ results: [{ index: 0, relevance_score: 0.9 }] }),
    );
    const r = new JinaReranker({ ...baseOpts, model: "jina-reranker-v2", transport });
    const cands = Array.from({ length: 200 }, (_, i) => scored(`c${i}`, 0.5));
    const texts = cands.map((_, i) => `t-${i}`);
    await r.rerank("q", cands, { texts });
    const body = JSON.parse(transport.captured[0]!.body);
    expect(body.model).toBe("jina-reranker-v2");
    expect(body.query).toBe("q");
    expect(body.documents).toHaveLength(100);
    expect(body.top_n).toBe(100);
  });

  it("decodes results[].relevance_score", async () => {
    const transport = new StubTransport(() =>
      jsonResponse({
        results: [
          { index: 1, relevance_score: 0.7 },
          { index: 0, relevance_score: 0.3 },
        ],
      }),
    );
    const r = new JinaReranker({ ...baseOpts, model: "jina-reranker-v2", transport });
    const out = await r.rerank("q", [scored("a", 0.1), scored("b", 0.2)], {
      texts: ["t-a", "t-b"],
    });
    expect(out.results.map((s) => s.chunk.id)).toEqual([createChunkId("b"), createChunkId("a")]);
    expect(out.results.map((s) => s.score)).toEqual([0.7, 0.3]);
  });

  it("uses the supplied baseUrl for self-hosted Jina", async () => {
    const transport = new StubTransport(() =>
      jsonResponse({ results: [{ index: 0, relevance_score: 0.9 }] }),
    );
    const r = new JinaReranker({
      ...baseOpts,
      model: "jina-reranker-v2",
      transport,
      baseUrl: "https://my-jina.example",
    });
    await r.rerank("q", [scored("a", 0.5)], { texts: ["t"] });
    expect(transport.captured[0]!.url).toBe("https://my-jina.example/v1/rerank");
  });

  it("name includes the model", () => {
    const transport = new StubTransport(() => jsonResponse({ results: [] }));
    const r = new JinaReranker({ ...baseOpts, model: "jina-reranker-v2", transport });
    expect(r.name).toBe("jina-jina-reranker-v2");
  });
});

describe("VoyageReranker", () => {
  it("uses /v1/rerank and top_k in the body", async () => {
    const transport = new StubTransport(() =>
      jsonResponse({ data: [{ index: 0, relevance_score: 0.9 }] }),
    );
    const r = new VoyageReranker({ ...baseOpts, model: "rerank-2", transport });
    const cands = Array.from({ length: 200 }, (_, i) => scored(`c${i}`, 0.5));
    const texts = cands.map((_, i) => `t-${i}`);
    await r.rerank("q", cands, { texts });
    expect(transport.captured[0]!.url).toBe("https://api.voyageai.com/v1/rerank");
    const body = JSON.parse(transport.captured[0]!.body);
    expect(body.model).toBe("rerank-2");
    expect(body.query).toBe("q");
    expect(body.documents).toHaveLength(100);
    expect(body.top_k).toBe(100);
  });

  it("decodes data[].relevance_score", async () => {
    const transport = new StubTransport(() =>
      jsonResponse({
        data: [
          { index: 1, relevance_score: 0.8 },
          { index: 0, relevance_score: 0.2 },
        ],
      }),
    );
    const r = new VoyageReranker({ ...baseOpts, model: "rerank-2", transport });
    const out = await r.rerank("q", [scored("a", 0.1), scored("b", 0.2)], {
      texts: ["t-a", "t-b"],
    });
    expect(out.results.map((s) => s.chunk.id)).toEqual([createChunkId("b"), createChunkId("a")]);
  });
});

describe("CohereReranker", () => {
  it("uses /v2/rerank and top_n in the body", async () => {
    const transport = new StubTransport(() =>
      jsonResponse({ results: [{ index: 0, relevance_score: 0.9 }] }),
    );
    const r = new CohereReranker({ ...baseOpts, model: "rerank-v3.5", transport });
    const cands = Array.from({ length: 200 }, (_, i) => scored(`c${i}`, 0.5));
    const texts = cands.map((_, i) => `t-${i}`);
    await r.rerank("q", cands, { texts });
    expect(transport.captured[0]!.url).toBe("https://api.cohere.com/v2/rerank");
    const body = JSON.parse(transport.captured[0]!.body);
    expect(body.model).toBe("rerank-v3.5");
    expect(body.query).toBe("q");
    expect(body.documents).toHaveLength(100);
    expect(body.top_n).toBe(100);
  });
});

describe("BGEReranker", () => {
  it("requires baseUrl", () => {
    const transport = new StubTransport(() => jsonResponse({ results: [] }));
    expect(
      () => new BGEReranker({ ...baseOpts, model: "bge-reranker-v2-m3", transport }),
    ).toThrow(KernelError);
  });

  it("uses /v1/rerank, omits Authorization, sends model/query/documents", async () => {
    const transport = new StubTransport(() =>
      jsonResponse({ results: [{ index: 0, score: 0.9 }] }),
    );
    const r = new BGEReranker({
      ...baseOpts,
      model: "bge-reranker-v2-m3",
      transport,
      baseUrl: "http://localhost:8080",
    });
    await r.rerank("q", [scored("a", 0.5)], { texts: ["t"] });
    const sent = transport.captured[0]!;
    expect(sent.url).toBe("http://localhost:8080/v1/rerank");
    expect(sent.headers["Authorization"]).toBeUndefined();
    const body = JSON.parse(sent.body);
    expect(body).toEqual({
      model: "bge-reranker-v2-m3",
      query: "q",
      documents: ["t"],
    });
  });

  it("decodes results[].score", async () => {
    const transport = new StubTransport(() =>
      jsonResponse({
        results: [
          { index: 1, score: 0.8 },
          { index: 0, score: 0.2 },
        ],
      }),
    );
    const r = new BGEReranker({
      ...baseOpts,
      model: "bge-reranker-v2-m3",
      transport,
      baseUrl: "http://localhost:8080",
    });
    const out = await r.rerank("q", [scored("a", 0.1), scored("b", 0.2)], {
      texts: ["t-a", "t-b"],
    });
    expect(out.results.map((s) => s.chunk.id)).toEqual([createChunkId("b"), createChunkId("a")]);
  });
});
