import { KernelError, newEmbeddingId } from "@lyra-sdk/kernel";
import type { Embedding } from "../../contracts/embedding.js";
import type { Embedder } from "../../contracts/embedder.js";
import { FetchHttpTransport, type HttpRequest, type HttpTransport } from "../../transport/http-transport.js";

/**
 * Options for {@link VoyageEmbedder}.
 */
export interface VoyageEmbedderOptions {
  /** API key. Required. */
  readonly apiKey: string;
  /** Voyage model. Default: `voyage-3`. */
  readonly model?: string;
  /** Optional pre-configured `HttpTransport`. */
  readonly transport?: HttpTransport;
  /** Voyage API base. Default: `https://api.voyageai.com/v1`. */
  readonly baseUrl?: string;
  /** Hard cap on a single batch. Default: 128 (Voyage's current cap). */
  readonly maxBatchSize?: number;
}

interface VoyageEmbeddingItem {
  readonly embedding: readonly number[];
}

interface VoyageEmbeddingResponse {
  readonly data: readonly VoyageEmbeddingItem[];
  readonly model: string;
}

/**
 * Voyage embedding provider. Uses `POST /v1/embeddings` directly via an
 * injected `HttpTransport`. No SDK dependency.
 */
export class VoyageEmbedder implements Embedder {
  private readonly apiKey: string;
  private readonly model: string;
  private readonly transport: HttpTransport;
  private readonly baseUrl: string;
  private readonly maxBatchSize: number;

  constructor(options: VoyageEmbedderOptions) {
    if (!options.apiKey) {
      throw new KernelError("invalid_argument", "VoyageEmbedder: apiKey is required");
    }
    this.apiKey = options.apiKey;
    this.model = options.model ?? "voyage-3";
    this.transport = options.transport ?? new FetchHttpTransport();
    this.baseUrl = options.baseUrl ?? "https://api.voyageai.com/v1";
    this.maxBatchSize = options.maxBatchSize ?? 128;
  }

  public async embed(input: string): Promise<Embedding> {
    const [embedding] = await this.embedMany([input]);
    if (!embedding) {
      throw new KernelError("upstream", "Voyage returned no embedding for a single input");
    }
    return embedding;
  }

  public async embedMany(inputs: readonly string[]): Promise<readonly Embedding[]> {
    if (inputs.length === 0) return [];
    if (inputs.length > this.maxBatchSize) {
      throw new KernelError(
        "invalid_argument",
        `VoyageEmbedder: batch size ${inputs.length} exceeds maxBatchSize ${this.maxBatchSize}`,
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
        `Voyage /embeddings returned ${res.status}: ${res.bodyText.slice(0, 500)}`,
      );
    }
    let parsed: VoyageEmbeddingResponse;
    try {
      parsed = JSON.parse(res.bodyText) as VoyageEmbeddingResponse;
    } catch (cause) {
      throw new KernelError("upstream", "Voyage returned non-JSON response", { cause });
    }
    if (!Array.isArray(parsed.data) || parsed.data.length !== inputs.length) {
      throw new KernelError("upstream", "Voyage response count does not match input count");
    }
    return parsed.data.map((item) => this.toEmbedding(item.embedding, parsed.model));
  }

  private toEmbedding(values: readonly number[], model: string): Embedding {
    if (!Array.isArray(values) || values.length === 0) {
      throw new KernelError("upstream", "Voyage returned an empty embedding");
    }
    const vector = new Float32Array(values.length);
    for (let i = 0; i < values.length; i++) {
      vector[i] = values[i]!;
    }
    return { id: newEmbeddingId(), vector, model, dimensions: vector.length };
  }
}
