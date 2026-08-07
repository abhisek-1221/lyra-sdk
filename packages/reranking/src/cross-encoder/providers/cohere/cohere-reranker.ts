import { KernelError } from "@lyra-sdk/kernel";
import type { CrossEncoderRequest, CrossEncoderResponse } from "../../cross-encoder-reranker.js";
import { CrossEncoderReranker } from "../../cross-encoder-reranker.js";
import type { CrossEncoderRerankerOptions } from "../../cross-encoder-reranker.js";

const DEFAULT_BASE_URL = "https://api.cohere.com";

/**
 * The Cohere reranker (`POST https://api.cohere.com/v2/rerank`).
 *
 * Request: `{ model, query, documents, top_n }`.
 * Response: `{ results: [{ index, relevance_score }] }`.
 */
export class CohereReranker extends CrossEncoderReranker {
  constructor(options: CrossEncoderRerankerOptions) {
    super(options);
    if (this.name === `cross-encoder-${this.model}`) {
      (this as { name: string }).name = `cohere-${this.model}`;
    }
  }

  protected override defaultBaseUrl(): string {
    return this.baseUrl ?? DEFAULT_BASE_URL;
  }

  protected override endpoint(): string {
    return "/v2/rerank";
  }

  protected override headers(): Readonly<Record<string, string>> {
    return {
      "Content-Type": "application/json",
      Authorization: `Bearer ${this.apiKey}`,
    };
  }

  protected override toRequestBody(req: CrossEncoderRequest, model: string): unknown {
    const body: Record<string, unknown> = {
      model,
      query: req.query,
      documents: [...req.documents],
    };
    if (req.topN !== undefined) {
      body["top_n"] = req.topN;
    }
    return body;
  }

  protected override toResponse(raw: unknown): CrossEncoderResponse {
    if (raw === null || typeof raw !== "object") {
      throw new KernelError("upstream", "CohereReranker: response is not an object");
    }
    const obj = raw as { results?: unknown };
    if (!Array.isArray(obj.results)) {
      throw new KernelError("upstream", "CohereReranker: response.results is not an array");
    }
    const rankings: { index: number; score: number }[] = [];
    for (const item of obj.results) {
      if (item === null || typeof item !== "object") continue;
      const r = item as { index?: unknown; relevance_score?: unknown };
      if (typeof r.index !== "number" || typeof r.relevance_score !== "number") continue;
      rankings.push({ index: r.index, score: r.relevance_score });
    }
    return { rankings };
  }
}
