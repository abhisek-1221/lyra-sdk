import { KernelError } from "@lyra-sdk/kernel";
import type { ScoredChunk } from "@lyra-sdk/retrieval";
import type { RerankResult, RerankerOptions } from "../contracts/index.js";
import type { Reranker } from "../contracts/reranker.js";
import type { CrossEncoderTransport } from "./transport.js";

/**
 * The provider-neutral request shape. A concrete provider
 * converts this into the provider-specific JSON body.
 */
export interface CrossEncoderRequest {
  /** The query the documents are being scored against. */
  readonly query: string;
  /** The candidate documents, in input order. */
  readonly documents: readonly string[];
  /** How many top-scored results to return. Default: documents.length. */
  readonly topN?: number;
}

/**
 * The provider-neutral response. Each entry maps an index into
 * the input `documents` array to a relevance score. Higher is
 * more relevant; the scale is provider-specific.
 */
export interface CrossEncoderResponse {
  /** Indexes into the input `documents` array, ordered by score desc. */
  readonly rankings: readonly {
    readonly index: number;
    readonly score: number;
  }[];
}

/**
 * Options for {@link CrossEncoderReranker} and its concrete
 * providers. The transport is required for testability; the
 * `apiKey` and `model` are required for live calls.
 */
export interface CrossEncoderRerankerOptions extends RerankerOptions {
  readonly apiKey: string;
  readonly model: string;
  readonly transport: CrossEncoderTransport;
  /** Optional base URL override for self-hosted endpoints. */
  readonly baseUrl?: string;
  /** Max documents per request. Default: 100. */
  readonly batchSize: number;
  /** Max parallel batches. Default: 4. */
  readonly concurrency: number;
}

/**
 * The abstract base for every cross-encoder provider. Subclasses
 * supply three pieces:
 *
 *   - `endpoint()` — the URL the request is sent to (relative
 *     paths resolved against the provider's default).
 *   - `toRequestBody(req, model)` — encode a `CrossEncoderRequest`
 *     into the provider's native JSON shape.
 *   - `toResponse(raw)` — decode the provider's native JSON
 *     response into a `CrossEncoderResponse`.
 *
 * The base class handles batching, concurrency, and the
 * `Reranker` -> `ScoredChunk[]` join. Subclasses never call the
 * transport directly; they only shape the body and response.
 *
 * Cross-encoder rerankers REQUIRE that the caller pass the
 * candidate texts. Lyra's `ScoredChunk` carries a `Chunk` (span
 * only), not content; the resolver that turns chunks into text
 * is the responsibility of the caller, not the reranker.
 */
export abstract class CrossEncoderReranker implements Reranker {
  public readonly name: string;
  protected readonly apiKey: string;
  protected readonly model: string;
  protected readonly transport: CrossEncoderTransport;
  protected readonly baseUrl: string | undefined;
  protected readonly batchSize: number;
  protected readonly concurrency: number;

  protected constructor(options: CrossEncoderRerankerOptions) {
    if (options.apiKey.length === 0) {
      throw new KernelError("invalid_argument", "CrossEncoderReranker: apiKey is required");
    }
    if (options.model.length === 0) {
      throw new KernelError("invalid_argument", "CrossEncoderReranker: model is required");
    }
    if (!Number.isInteger(options.batchSize) || options.batchSize <= 0) {
      throw new KernelError(
        "invalid_argument",
        `CrossEncoderReranker: batchSize must be a positive integer, got ${options.batchSize}`,
      );
    }
    if (!Number.isInteger(options.concurrency) || options.concurrency <= 0) {
      throw new KernelError(
        "invalid_argument",
        `CrossEncoderReranker: concurrency must be a positive integer, got ${options.concurrency}`,
      );
    }
    this.apiKey = options.apiKey;
    this.model = options.model;
    this.transport = options.transport;
    this.baseUrl = options.baseUrl;
    this.batchSize = options.batchSize;
    this.concurrency = options.concurrency;
    this.name = options.name ?? `cross-encoder-${this.model}`;
  }

  /**
   * Subclass-supplied endpoint path, relative to the provider's
   * base URL. The base URL is `options.baseUrl` if supplied, else
   * the provider's documented default.
   */
  protected abstract endpoint(): string;

  /**
   * Subclass-supplied request encoder.
   */
  protected abstract toRequestBody(req: CrossEncoderRequest, model: string): unknown;

  /**
   * Subclass-supplied response decoder. Must throw
   * `KernelError("upstream", ...)` on a malformed response.
   */
  protected abstract toResponse(raw: unknown): CrossEncoderResponse;

  /**
   * Subclass-supplied request headers. Defaults to
   * `Content-Type: application/json` plus `Authorization: Bearer
   * <apiKey>`. Subclasses can override for non-bearer auth.
   */
  protected headers(): Readonly<Record<string, string>> {
    return {
      "Content-Type": "application/json",
      Authorization: `Bearer ${this.apiKey}`,
    };
  }

  /**
   * The base URL for the provider. Defaults to the provider's
   * documented URL; subclasses with a self-hosted variant can
   * read `this.baseUrl` first.
   */
  protected defaultBaseUrl(): string {
    return this.baseUrl ?? "";
  }

  public async rerank(
    query: string,
    candidates: readonly ScoredChunk[],
    options?: RerankerOptions,
  ): Promise<RerankResult> {
    const start = Date.now();
    if (candidates.length === 0) {
      return { results: [], durationMs: Date.now() - start };
    }
    const texts = options?.texts;
    if (texts === undefined) {
      throw new KernelError(
        "invalid_argument",
        "CrossEncoderReranker.rerank: options.texts is required (Lyra ScoredChunk has no text field; the caller must resolve and pass it)",
      );
    }
    if (texts.length !== candidates.length) {
      throw new KernelError(
        "invalid_argument",
        `CrossEncoderReranker: candidates.length (${candidates.length}) must equal texts.length (${texts.length})`,
      );
    }
    const providerStart = Date.now();
    const allRankings: { index: number; score: number; sourceIndex: number }[] = [];
    const effectiveTopN = Math.min(this.batchSize, candidates.length);
    const batches = chunk(texts, this.batchSize);
    const indexedBatches = batches.map((batch, b) => ({
      batch,
      baseIndex: b * this.batchSize,
    }));
    const executing = new Set<Promise<void>>();
    for (const { batch, baseIndex } of indexedBatches) {
      const p = this
        .callProvider({
          query,
          documents: batch,
          topN: effectiveTopN,
        })
        .then((res) => {
          for (const r of res.rankings) {
            if (r.index < 0 || r.index >= batch.length) continue;
            allRankings.push({
              index: baseIndex + r.index,
              score: r.score,
              sourceIndex: baseIndex + r.index,
            });
          }
        });
      executing.add(p);
      if (executing.size >= this.concurrency) {
        await Promise.race(executing);
        executing.clear();
      }
    }
    await Promise.all(executing);
    allRankings.sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      return a.sourceIndex - b.sourceIndex;
    });
    const seen = new Set<number>();
    const out: ScoredChunk[] = [];
    for (const r of allRankings) {
      if (seen.has(r.index)) continue;
      seen.add(r.index);
      const cand = candidates[r.index];
      if (cand === undefined) continue;
      out.push({ ...cand, score: r.score });
    }
    const providerLatency = Date.now() - providerStart;
    return {
      results: out,
      durationMs: Date.now() - start,
      diagnostics: {
        providerLatencyMs: providerLatency,
        candidates: candidates.length,
        batches: batches.length,
      },
    };
  }

  private async callProvider(req: CrossEncoderRequest): Promise<CrossEncoderResponse> {
    const url = `${this.defaultBaseUrl()}${this.endpoint()}`;
    const body = JSON.stringify(this.toRequestBody(req, this.model));
    const response = await this.transport.send({
      url,
      method: "POST",
      headers: this.headers(),
      body,
    });
    if (response.status < 200 || response.status >= 300) {
      throw new KernelError(
        "upstream",
        `CrossEncoderReranker: ${this.name} returned status ${response.status}: ${response.bodyText.slice(0, 256)}`,
      );
    }
    let raw: unknown;
    try {
      raw = JSON.parse(response.bodyText);
    } catch (e) {
      throw new KernelError(
        "upstream",
        `CrossEncoderReranker: ${this.name} returned non-JSON body`,
        { cause: e },
      );
    }
    return this.toResponse(raw);
  }
}

function chunk<T>(items: readonly T[], size: number): T[][] {
  if (size <= 0) return [items.slice()];
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    out.push(items.slice(i, i + size));
  }
  return out;
}
