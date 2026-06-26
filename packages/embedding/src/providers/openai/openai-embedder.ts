import { createEmbeddingId, KernelError, newEmbeddingId } from "@lyra-sdk/kernel";
import type { Embedding } from "../../contracts/embedding.js";
import type { Embedder } from "../../contracts/embedder.js";
import type { HttpRequest, HttpTransport } from "../../transport/http-transport.js";

/**
 * Options for {@link OpenAIEmbedder}.
 */
export interface OpenAIEmbedderOptions {
  /** API key. Required. */
  readonly apiKey: string;
  /** OpenAI model. Default: `text-embedding-3-small`. */
  readonly model?: string;
  /**
   * Optional pre-configured `HttpTransport`. Defaults to
   * {@link FetchHttpTransport}; tests pass a stub.
   */
  readonly transport?: HttpTransport;
  /**
   * OpenAI API base. Override for OpenAI-compatible gateways
   * (Azure, OpenRouter, vLLM with the OpenAI shim, etc.).
   * Default: `https://api.openai.com/v1`.
   */
  readonly baseUrl?: string;
  /**
   * Hard cap on a single batch request. Default: 2048.
   * OpenAI's current limit is 2048 inputs per call.
   */
  readonly maxBatchSize?: number;
}

interface OpenAiEmbeddingItem {
  readonly embedding: readonly number[];
  readonly index: number;
}

interface OpenAiEmbeddingResponse {
  readonly data: readonly OpenAiEmbeddingItem[];
  readonly model: string;
}

/**
 * OpenAI embedding provider. Uses the `POST /v1/embeddings` endpoint
 * directly via an injected `HttpTransport`. No SDK dependency.
 *
 * The provider is a thin adapter:
 *   1. Map `(inputs) → request body`.
 *   2. `transport.send(request)`.
 *   3. Map `(response) → readonly Embedding[]`.
 *
 * The provider does NOT batch internally beyond respecting
 * `maxBatchSize`. Higher-level batching (token-aware) is the
 * responsibility of `TokenBatcher` (Phase 1 slice 8).
 */
export class OpenAIEmbedder implements Embedder {
  private readonly apiKey: string;
  private readonly model: string;
  private readonly transport: HttpTransport;
  private readonly baseUrl: string;
  private readonly maxBatchSize: number;

  constructor(options: OpenAIEmbedderOptions) {
    if (!options.apiKey) {
      throw new KernelError("invalid_argument", "OpenAIEmbedder: apiKey is required");
    }
    this.apiKey = options.apiKey;
    this.model = options.model ?? "text-embedding-3-small";
    this.transport = options.transport ?? new (class implements HttpTransport {
      // Late import: FetchHttpTransport is a small wrapper around `fetch`.
      // We import the symbol lazily so this file's class body doesn't
      // require top-level import.
      async send(req: HttpRequest, signal?: AbortSignal) {
        const { FetchHttpTransport } = await import("../../transport/http-transport.js");
        return new FetchHttpTransport().send(req, signal);
      }
    })();
    this.baseUrl = options.baseUrl ?? "https://api.openai.com/v1";
    this.maxBatchSize = options.maxBatchSize ?? 2048;
  }

  public async embed(input: string): Promise<Embedding> {
    const [embedding] = await this.embedMany([input]);
    if (!embedding) {
      throw new KernelError("upstream", "OpenAI returned no embedding for a single input");
    }
    return embedding;
  }

  public async embedMany(inputs: readonly string[]): Promise<readonly Embedding[]> {
    if (inputs.length === 0) return [];
    if (inputs.length > this.maxBatchSize) {
      throw new KernelError(
        "invalid_argument",
        `OpenAIEmbedder: batch size ${inputs.length} exceeds maxBatchSize ${this.maxBatchSize}`,
      );
    }
    const body = JSON.stringify({ model: this.model, input: [...inputs] });
    const request: HttpRequest = {
      url: `${this.baseUrl}/embeddings`,
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${this.apiKey}`,
      },
      body,
    };
    const res = await this.transport.send(request);
    if (res.status < 200 || res.status >= 300) {
      throw new KernelError(
        "upstream",
        `OpenAI /embeddings returned ${res.status}: ${res.bodyText.slice(0, 500)}`,
      );
    }
    let parsed: OpenAiEmbeddingResponse;
    try {
      parsed = JSON.parse(res.bodyText) as OpenAiEmbeddingResponse;
    } catch (cause) {
      throw new KernelError("upstream", "OpenAI returned non-JSON response", { cause });
    }
    if (!Array.isArray(parsed.data)) {
      throw new KernelError("upstream", "OpenAI response missing `data` array");
    }
    // OpenAI returns one item per input, with an `index` field. Sort by
    // index so the result order matches the input order even if the
    // provider reorders (it doesn't, but defensive code is cheap).
    const sorted = [...parsed.data].sort((a, b) => a.index - b.index);
    return sorted.map((item) => this.toEmbedding(item.embedding, parsed.model));
  }

  private toEmbedding(values: readonly number[], model: string): Embedding {
    if (!Array.isArray(values) || values.length === 0) {
      throw new KernelError("upstream", "OpenAI returned an empty embedding");
    }
    const vector = new Float32Array(values.length);
    for (let i = 0; i < values.length; i++) {
      vector[i] = values[i]!;
    }
    return {
      id: newEmbeddingId(),
      vector,
      model,
      dimensions: vector.length,
    };
  }
}

// Suppress unused-import warning for `createEmbeddingId` — kept for
// parity with future embedders that may mint deterministic ids.
void createEmbeddingId;
