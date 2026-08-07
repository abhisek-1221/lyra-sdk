import { KernelError } from "@lyra-sdk/kernel";
import type { CrossEncoderRequest, CrossEncoderResponse } from "../../cross-encoder-reranker.js";
import { CrossEncoderReranker } from "../../cross-encoder-reranker.js";
import type { CrossEncoderRerankerOptions } from "../../cross-encoder-reranker.js";

/**
 * The BGE reranker. BGE reranker endpoints are typically
 * self-hosted (BGE-reranker-v2-m3 via Xinference, vLLM, TEI, or
 * the official BGE container) and follow the OpenAI-compatible
 * `/v1/rerank` shape:
 *
 * Request: `{ model, query, documents }`.
 * Response: `{ results: [{ index, score }] }`.
 *
 * The `baseUrl` option is **required** for BGE; there is no
 * sensible default. Subclasses (e.g. Xinference) can override
 * `defaultBaseUrl` if they need a different default.
 */
export class BGEReranker extends CrossEncoderReranker {
  constructor(options: CrossEncoderRerankerOptions) {
    super(options);
    if (this.name === `cross-encoder-${this.model}`) {
      (this as { name: string }).name = `bge-${this.model}`;
    }
    if (this.baseUrl === undefined) {
      throw new KernelError(
        "invalid_argument",
        "BGEReranker: baseUrl is required (BGE is self-hosted)",
      );
    }
  }

  protected override endpoint(): string {
    return "/v1/rerank";
  }

  protected override headers(): Readonly<Record<string, string>> {
    return {
      "Content-Type": "application/json",
    };
  }

  protected override toRequestBody(req: CrossEncoderRequest, model: string): unknown {
    return {
      model,
      query: req.query,
      documents: [...req.documents],
    };
  }

  protected override toResponse(raw: unknown): CrossEncoderResponse {
    if (raw === null || typeof raw !== "object") {
      throw new KernelError("upstream", "BGEReranker: response is not an object");
    }
    const obj = raw as { results?: unknown };
    if (!Array.isArray(obj.results)) {
      throw new KernelError("upstream", "BGEReranker: response.results is not an array");
    }
    const rankings: { index: number; score: number }[] = [];
    for (const item of obj.results) {
      if (item === null || typeof item !== "object") continue;
      const r = item as { index?: unknown; score?: unknown };
      if (typeof r.index !== "number" || typeof r.score !== "number") continue;
      rankings.push({ index: r.index, score: r.score });
    }
    return { rankings };
  }
}
