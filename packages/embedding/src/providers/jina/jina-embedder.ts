import { KernelError, newEmbeddingId } from "@lyra-sdk/kernel";
import type { Embedding } from "../../contracts/embedding.js";
import type { Embedder } from "../../contracts/embedder.js";
import { FetchHttpTransport, type HttpRequest, type HttpTransport } from "../../transport/http-transport.js";

/**
 * Options for {@link JinaEmbedder}.
 */
export interface JinaEmbedderOptions {
  /** API key. Required. */
  readonly apiKey: string;
  /** Jina model. Default: `jina-embeddings-v3`. */
  readonly model?: string;
  /** Optional pre-configured `HttpTransport`. */
  readonly transport?: HttpTransport;
  /** Jina API base. Default: `https://api.jina.ai/v1`. */
  readonly baseUrl?: string;
  /** Hard cap on a single batch. Default: 2048. */
  readonly maxBatchSize?: number;
}

interface JinaEmbeddingItem {
  readonly embedding: readonly number[];
}

interface JinaEmbeddingResponse {
  readonly data: readonly JinaEmbeddingItem[];
  readonly model: string;
}

/**
 * Jina embedding provider. Uses `POST /v1/embeddings` directly via an
 * injected `HttpTransport`. No SDK dependency.
 */
export class JinaEmbedder implements Embedder {
  private readonly apiKey: string;
  private readonly model: string;
  private readonly transport: HttpTransport;
  private readonly baseUrl: string;
  private readonly maxBatchSize: number;

  constructor(options: JinaEmbedderOptions) {
    if (!options.apiKey) {
      throw new KernelError("invalid_argument", "JinaEmbedder: apiKey is required");
    }
    this.apiKey = options.apiKey;
    this.model = options.model ?? "jina-embeddings-v3";
    this.transport = options.transport ?? new FetchHttpTransport();
    this.baseUrl = options.baseUrl ?? "https://api.jina.ai/v1";
    this.maxBatchSize = options.maxBatchSize ?? 2048;
  }

  public async embed(input: string): Promise<Embedding> {
    const [embedding] = await this.embedMany([input]);
    if (!embedding) {
      throw new KernelError("upstream", "Jina returned no embedding for a single input");
    }
    return embedding;
  }

  public async embedMany(inputs: readonly string[]): Promise<readonly Embedding[]> {
    if (inputs.length === 0) return [];
    if (inputs.length > this.maxBatchSize) {
      throw new KernelError(
        "invalid_argument",
        `JinaEmbedder: batch size ${inputs.length} exceeds maxBatchSize ${this.maxBatchSize}`,
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
        `Jina /embeddings returned ${res.status}: ${res.bodyText.slice(0, 500)}`,
      );
    }
    let parsed: JinaEmbeddingResponse;
    try {
      parsed = JSON.parse(res.bodyText) as JinaEmbeddingResponse;
    } catch (cause) {
      throw new KernelError("upstream", "Jina returned non-JSON response", { cause });
    }
    if (!Array.isArray(parsed.data) || parsed.data.length !== inputs.length) {
      throw new KernelError("upstream", "Jina response count does not match input count");
    }
    return parsed.data.map((item) => this.toEmbedding(item.embedding, parsed.model));
  }

  private toEmbedding(values: readonly number[], model: string): Embedding {
    if (!Array.isArray(values) || values.length === 0) {
      throw new KernelError("upstream", "Jina returned an empty embedding");
    }
    const vector = new Float32Array(values.length);
    for (let i = 0; i < values.length; i++) {
      vector[i] = values[i]!;
    }
    return { id: newEmbeddingId(), vector, model, dimensions: vector.length };
  }
}
