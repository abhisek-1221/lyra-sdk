import { KernelError } from "@lyra-sdk/kernel";
import type { CrossEncoderRequest, CrossEncoderResponse } from "../../cross-encoder-reranker.js";
import { CrossEncoderReranker } from "../../cross-encoder-reranker.js";
import type { CrossEncoderRerankerOptions } from "../../cross-encoder-reranker.js";

const DEFAULT_BASE_URL = "https://api.voyageai.com";

/**
 * The Voyage reranker (`POST https://api.voyageai.com/v1/rerank`).
 *
 * Request: `{ model, query, documents, top_k }`.
 * Response: `{ data: [{ index, relevance_score }] }`.
 */
export class VoyageReranker extends CrossEncoderReranker {
  constructor(options: CrossEncoderRerankerOptions) {
    super(options);
    if (this.name === `cross-encoder-${this.model}`) {
      (this as { name: string }).name = `voyage-${this.model}`;
    }
  }

  protected override defaultBaseUrl(): string {
    return this.baseUrl ?? DEFAULT_BASE_URL;
  }

  protected override endpoint(): string {
    return "/v1/rerank";
  }

  protected override toRequestBody(req: CrossEncoderRequest, model: string): unknown {
    const body: Record<string, unknown> = {
      model,
      query: req.query,
      documents: [...req.documents],
    };
    if (req.topN !== undefined) {
      body["top_k"] = req.topN;
    }
    return body;
  }

  protected override toResponse(raw: unknown): CrossEncoderResponse {
    if (raw === null || typeof raw !== "object") {
      throw new KernelError("upstream", "VoyageReranker: response is not an object");
    }
    const obj = raw as { data?: unknown };
    if (!Array.isArray(obj.data)) {
      throw new KernelError("upstream", "VoyageReranker: response.data is not an array");
    }
    const rankings: { index: number; score: number }[] = [];
    for (const item of obj.data) {
      if (item === null || typeof item !== "object") continue;
      const r = item as { index?: unknown; relevance_score?: unknown };
      if (typeof r.index !== "number" || typeof r.relevance_score !== "number") continue;
      rankings.push({ index: r.index, score: r.relevance_score });
    }
    return { rankings };
  }
}
