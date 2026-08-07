import { KernelError, newEmbeddingId } from "@lyra-sdk/kernel";
import type { Embedding } from "../../contracts/embedding.js";
import type { Embedder } from "../../contracts/embedder.js";
import { FetchHttpTransport, type HttpRequest, type HttpTransport } from "../../transport/http-transport.js";

/**
 * Options for {@link OllamaEmbedder}.
 */
export interface OllamaEmbedderOptions {
  /** Ollama model. Required (e.g. `nomic-embed-text`, `mxbai-embed-large`). */
  readonly model: string;
  /**
   * Optional pre-configured `HttpTransport`. Defaults to
   * {@link FetchHttpTransport}; tests pass a stub.
   */
  readonly transport?: HttpTransport;
  /**
   * Ollama API base. Default: `http://localhost:11434`.
   */
  readonly baseUrl?: string;
}

interface OllamaEmbeddingItem {
  readonly embedding: readonly number[];
}

interface OllamaEmbeddingResponse {
  readonly embeddings?: readonly OllamaEmbeddingItem[];
  readonly embedding?: readonly number[];
  readonly model?: string;
}

/**
 * Ollama embedding provider. Uses the `POST /api/embed` endpoint
 * directly via an injected `HttpTransport`. No SDK dependency.
 *
 * Ollama's API accepts a `prompt` (legacy, single) or `input` (array)
 * and returns either `{"embedding": [...]}` (single) or
 * `{"embeddings": [{...}, ...]}` (batch). We always send `input` (the
 * array form) and accept either response shape.
 *
 * The provider does NOT batch internally. Higher-level batching
 * (token-aware) is the responsibility of `TokenBatcher`.
 */
export class OllamaEmbedder implements Embedder {
  private readonly model: string;
  private readonly transport: HttpTransport;
  private readonly baseUrl: string;

  constructor(options: OllamaEmbedderOptions) {
    if (!options.model) {
      throw new KernelError("invalid_argument", "OllamaEmbedder: model is required");
    }
    this.model = options.model;
    this.transport = options.transport ?? new FetchHttpTransport();
    this.baseUrl = options.baseUrl ?? "http://localhost:11434";
  }

  public async embed(input: string): Promise<Embedding> {
    const [embedding] = await this.embedMany([input]);
    if (!embedding) {
      throw new KernelError("upstream", "Ollama returned no embedding for a single input");
    }
    return embedding;
  }

  public async embedMany(inputs: readonly string[]): Promise<readonly Embedding[]> {
    if (inputs.length === 0) return [];
    const body = JSON.stringify({ model: this.model, input: [...inputs] });
    const request: HttpRequest = {
      url: `${this.baseUrl}/api/embed`,
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body,
    };
    const res = await this.transport.send(request);
    if (res.status < 200 || res.status >= 300) {
      throw new KernelError(
        "upstream",
        `Ollama /api/embed returned ${res.status}: ${res.bodyText.slice(0, 500)}`,
      );
    }
    let parsed: OllamaEmbeddingResponse;
    try {
      parsed = JSON.parse(res.bodyText) as OllamaEmbeddingResponse;
    } catch (cause) {
      throw new KernelError("upstream", "Ollama returned non-JSON response", { cause });
    }
    const vectors: number[][] = parsed.embeddings
      ? parsed.embeddings.map((e) => [...e.embedding])
      : parsed.embedding
        ? [[...parsed.embedding]]
        : [];
    if (vectors.length !== inputs.length) {
      throw new KernelError(
        "upstream",
        `Ollama returned ${vectors.length} embeddings for ${inputs.length} inputs`,
      );
    }
    return vectors.map((v) => this.toEmbedding(v, parsed.model ?? this.model));
  }

  private toEmbedding(values: readonly number[], model: string): Embedding {
    if (!Array.isArray(values) || values.length === 0) {
      throw new KernelError("upstream", "Ollama returned an empty embedding");
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
