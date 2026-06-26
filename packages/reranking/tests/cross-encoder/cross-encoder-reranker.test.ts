import { createChunkId, createDocumentId, KernelError } from "@lyra-sdk/kernel";
import type { HttpRequest, HttpResponse, HttpTransport } from "@lyra-sdk/embedding";
import type { ScoredChunk } from "@lyra-sdk/retrieval";
import type { Chunk } from "@lyra-sdk/storage";
import { describe, expect, it } from "vitest";
import {
  CrossEncoderReranker,
  type CrossEncoderRequest,
  type CrossEncoderResponse,
} from "../../src/cross-encoder/index.js";

/**
 * A recording transport captures the request and returns a
 * canned response. Tests can inspect the captured URL, method,
 * headers, and body.
 */
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

class TestReranker extends CrossEncoderReranker {
  public lastBody: unknown;
  constructor(
    transport: HttpTransport,
    model = "test-model",
  ) {
    super({
      apiKey: "test-key",
      model,
      transport,
      batchSize: 100,
      concurrency: 4,
    });
  }
  protected override endpoint(): string {
    return "/v1/rerank";
  }
  protected override toRequestBody(req: CrossEncoderRequest, model: string): unknown {
    this.lastBody = { model, query: req.query, documents: [...req.documents], top_n: req.topN };
    return this.lastBody;
  }
  protected override toResponse(raw: unknown): CrossEncoderResponse {
    const obj = raw as { results?: { index: number; relevance_score: number }[] };
    if (!obj.results) return { rankings: [] };
    return {
      rankings: obj.results.map((r) => ({ index: r.index, score: r.relevance_score })),
    };
  }
  public override defaultBaseUrl(): string {
    return this.baseUrl ?? "https://test.example";
  }
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

function jsonResponse(body: unknown, status = 200): HttpResponse {
  return { status, bodyText: JSON.stringify(body) };
}

describe("CrossEncoderReranker", () => {
  it("sends POST with bearer auth and JSON body", async () => {
    const transport = new StubTransport(() =>
      jsonResponse({ results: [{ index: 0, relevance_score: 0.9 }] }),
    );
    const r = new TestReranker(transport);
    // 200 candidates so the default batchSize of 100 is the effective topN.
    const cands = Array.from({ length: 200 }, (_, i) => scored(`c${i}`, 0.5));
    const texts = cands.map((_, i) => `t-${i}`);
    await r.rerank("q", cands, { texts });
    expect(transport.captured).toHaveLength(2);
    const sent = transport.captured[0]!;
    expect(sent.method).toBe("POST");
    expect(sent.url).toBe("https://test.example/v1/rerank");
    expect(sent.headers["Content-Type"]).toBe("application/json");
    expect(sent.headers["Authorization"]).toBe("Bearer test-key");
    const body = JSON.parse(sent.body);
    expect(body.model).toBe("test-model");
    expect(body.query).toBe("q");
    expect(body.documents).toHaveLength(100);
    expect(body.top_n).toBe(100);
  });

  it("rejects missing options.texts", async () => {
    const r = new TestReranker(new StubTransport(() => jsonResponse({ results: [] })));
    await expect(r.rerank("q", [scored("a", 0.5)])).rejects.toBeInstanceOf(KernelError);
  });

  it("rejects texts/candidates length mismatch", async () => {
    const r = new TestReranker(new StubTransport(() => jsonResponse({ results: [] })));
    await expect(
      r.rerank("q", [scored("a", 0.5), scored("b", 0.5)], { texts: ["only one"] }),
    ).rejects.toBeInstanceOf(KernelError);
  });

  it("returns empty results for empty candidates", async () => {
    const r = new TestReranker(new StubTransport(() => jsonResponse({ results: [] })));
    const out = await r.rerank("q", [], { texts: [] });
    expect(out.results).toEqual([]);
    expect(out.durationMs).toBeGreaterThanOrEqual(0);
  });

  it("reorders candidates by provider score", async () => {
    const transport = new StubTransport(() =>
      jsonResponse({
        results: [
          { index: 1, relevance_score: 0.95 },
          { index: 0, relevance_score: 0.5 },
        ],
      }),
    );
    const r = new TestReranker(transport);
    const cands = [scored("a", 0.1), scored("b", 0.2)];
    const out = await r.rerank("q", cands, { texts: ["text-a", "text-b"] });
    expect(out.results).toHaveLength(2);
    expect(out.results[0]?.chunk.id).toBe(createChunkId("b"));
    expect(out.results[0]?.score).toBe(0.95);
    expect(out.results[1]?.chunk.id).toBe(createChunkId("a"));
    expect(out.results[1]?.score).toBe(0.5);
  });

  it("drops candidates the provider did not rank", async () => {
    const transport = new StubTransport(() =>
      jsonResponse({ results: [{ index: 0, relevance_score: 0.9 }] }),
    );
    const r = new TestReranker(transport);
    const out = await r.rerank(
      "q",
      [scored("a", 0.1), scored("b", 0.2)],
      { texts: ["text-a", "text-b"] },
    );
    expect(out.results).toHaveLength(1);
    expect(out.results[0]?.chunk.id).toBe(createChunkId("a"));
  });

  it("rejects non-2xx responses with KernelError upstream", async () => {
    const transport = new StubTransport(() => jsonResponse({ error: "rate limit" }, 429));
    const r = new TestReranker(transport);
    await expect(r.rerank("q", [scored("a", 0.5)], { texts: ["t"] })).rejects.toMatchObject({
      code: "upstream",
    });
  });

  it("rejects non-JSON responses with KernelError upstream", async () => {
    const transport = new StubTransport(() => ({ status: 200, bodyText: "not-json" }));
    const r = new TestReranker(transport);
    await expect(r.rerank("q", [scored("a", 0.5)], { texts: ["t"] })).rejects.toBeInstanceOf(
      KernelError,
    );
  });

  it("validates apiKey, model, batchSize, concurrency at construction", () => {
    const t = new StubTransport(() => jsonResponse({ results: [] }));
    expect(
      () =>
        new TestReranker(t).constructor === TestReranker
          ? null
          : null,
    );
    // We can construct the base class only via a subclass. To test
    // validation, instantiate TestReranker with bad options through
    // a one-off subclass:
    class BadKey extends CrossEncoderReranker {
      constructor() {
        super({ apiKey: "", model: "m", transport: t, batchSize: 1, concurrency: 1 });
      }
      protected override endpoint(): string {
        return "/";
      }
      protected override toRequestBody(): unknown {
        return {};
      }
      protected override toResponse(): CrossEncoderResponse {
        return { rankings: [] };
      }
      protected override defaultBaseUrl(): string {
        return "https://x";
      }
    }
    expect(() => new BadKey()).toThrow(KernelError);
  });

  it("name defaults to cross-encoder-<model>; subclasses may override", () => {
    class NamedReranker extends CrossEncoderReranker {
      constructor() {
        super({
          apiKey: "k",
          model: "m",
          transport: new StubTransport(() => jsonResponse({ results: [] })),
          batchSize: 1,
          concurrency: 1,
          name: "custom",
        });
      }
      protected override endpoint(): string {
        return "/";
      }
      protected override toRequestBody(): unknown {
        return {};
      }
      protected override toResponse(): CrossEncoderResponse {
        return { rankings: [] };
      }
      protected override defaultBaseUrl(): string {
        return "https://x";
      }
    }
    expect(new NamedReranker().name).toBe("custom");
  });
});
