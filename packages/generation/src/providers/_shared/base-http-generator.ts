import { KernelError } from "@lyra-sdk/kernel";
import { FetchHttpTransport, type HttpRequest, type HttpTransport } from "@lyra-sdk/embedding";
import type { GenerationChunk } from "../../contracts/generation-chunk.js";
import type { GenerationOptions } from "../../contracts/generation-options.js";
import type { GenerationRequest } from "../../contracts/generation-request.js";
import type { GenerationResponse } from "../../contracts/generation-response.js";
import type { Generator } from "../../contracts/generator.js";
import { collectStream, withTimeout } from "../../streaming/index.js";

/**
 * The base class every `Generator` extends. It owns:
 *
 *   - The injected `HttpTransport` (default: `FetchHttpTransport`).
 *   - The `AbortSignal` + `timeoutMs` composition (via `withTimeout`).
 *   - The streaming implementation that maps the provider's HTTP
 *     response into a `GenerationChunk` stream and emits exactly
 *     one `done` chunk (success) or one `error` chunk (failure).
 *   - The `generate` method, which is a thin wrapper over `stream`
 *     and `collectStream`. Subclasses do not implement `generate`.
 *
 * Subclasses implement three primitives:
 *
 *   - `buildRequest(prompt, options): HttpRequest` — provider wire
 *     format.
 *   - `parseStreamBody(response): AsyncIterable<unknown>` — turn
 *     the transport's `HttpResponse` into a stream of provider
 *     events (SSE for OpenAI/Anthropic/Gemini, NDJSON for Ollama).
 *   - `mapEvent(event): GenerationChunk | null` — provider event
 *     to chunk. Returning `null` skips the event.
 *
 * Subclasses also set `provider` and provide a `defaultModel`.
 */
export abstract class BaseHttpGenerator implements Generator {
  public abstract readonly provider: string;
  public readonly name: string;
  public readonly model: string;

  protected readonly transport: HttpTransport;
  protected readonly timeoutMs: number | undefined;
  // The `maxRetries` field is reserved for a future phase. It
  // exists so the public option surface is stable; the base
  // class does not retry in Phase 4.
  protected readonly maxRetries: number;

  constructor(options: BaseHttpGeneratorOptions) {
    this.name = options.name ?? options.defaultName;
    this.model = options.model ?? options.defaultModel;
    this.transport = options.transport ?? new FetchHttpTransport();
    this.timeoutMs = options.timeoutMs;
    this.maxRetries = options.maxRetries ?? 0;
  }

  public async generate<T = unknown>(
    request: GenerationRequest,
    options?: GenerationOptions,
  ): Promise<GenerationResponse<T>> {
    const chunks = this.stream(request, options);
    const response = await collectStream(chunks);
    return response as GenerationResponse<T>;
  }

  public async *stream(
    request: GenerationRequest,
    options?: GenerationOptions,
  ): AsyncIterable<GenerationChunk> {
    const startedAt = performance.now();
    const signal = withTimeout(options?.signal, options?.timeoutMs);

    let httpRequest: HttpRequest;
    try {
      httpRequest = this.buildRequest(request, options);
    } catch (err) {
      yield { type: "error", error: toKernelError(err, this.provider) };
      return;
    }

    let response: { status: number; bodyText: string };
    try {
      response = await this.transport.send(httpRequest, signal);
    } catch (err) {
      yield { type: "error", error: toKernelError(err, this.provider) };
      return;
    }

    if (response.status < 200 || response.status >= 300) {
      yield {
        type: "error",
        error: new KernelError(
          "upstream",
          `${this.provider} HTTP ${response.status}: ${truncate(response.bodyText, 500)}`,
        ),
      };
      return;
    }

    let aggregatedText = "";
    let usage: { inputTokens: number; outputTokens: number } | undefined;
    let aborted = false;

    try {
      for await (const event of this.parseStreamBody(response)) {
        if (signal?.aborted) {
          aborted = true;
          break;
        }
        const chunk = this.mapEvent(event);
        if (chunk === null || chunk === undefined) continue;
        if (chunk.type === "text") {
          aggregatedText += chunk.delta;
        } else if (chunk.type === "usage") {
          usage = chunk.usage;
        }
        yield chunk;
      }
    } catch (err) {
      yield { type: "error", error: toKernelError(err, this.provider) };
      return;
    }

    if (aborted || signal?.aborted) {
      yield {
        type: "error",
        error: makeAbortError(),
      };
      return;
    }

    const finalResponse = this.finalizeResponse({
      request,
      text: aggregatedText,
      usage,
      startedAt,
    });
    yield { type: "done", response: finalResponse };
  }

  /** Build the provider-specific HTTP request. */
  protected abstract buildRequest(
    request: GenerationRequest,
    options?: GenerationOptions,
  ): HttpRequest;

  /**
   * Turn the transport's `HttpResponse` into a stream of provider
   * events. The base class iterates this and calls `mapEvent` for
   * each.
   *
   * The default implementation splits the body on newlines and
   * yields one event per non-empty line. Subclasses may override
   * for SSE/NDJSON.
   */
  protected parseStreamBody(response: {
    readonly status: number;
    readonly bodyText: string;
  }): AsyncIterable<unknown> {
    return (async function* () {
      for (const line of response.bodyText.split(/\r?\n/)) {
        if (line.length === 0) continue;
        yield line;
      }
    })();
  }

  /**
   * Map a provider event to a chunk. Return `null` to skip an
   * event (e.g. SSE keepalives). Only `text` and `usage` chunks
   * are valid here; `done` and `error` are emitted by `finalize`.
   */
  protected abstract mapEvent(event: unknown): TextOrUsageChunk | null;

  /**
   * Build the final `GenerationResponse` from the accumulated text
   * and usage. Subclasses set `provider`, `model`, `finishReason`,
   * `citations`, and any per-provider `diagnostics`.
   */
  protected abstract finalizeResponse(args: {
    readonly request: GenerationRequest;
    readonly text: string;
    readonly usage: { inputTokens: number; outputTokens: number } | undefined;
    readonly startedAt: number;
  }): GenerationResponse;
}

/** The shape of chunks a `mapEvent` implementation may return. */
export type TextOrUsageChunk =
  | { type: "text"; delta: string }
  | { type: "usage"; usage: { inputTokens: number; outputTokens: number } };

export interface BaseHttpGeneratorOptions {
  /** Optional name override. Default: the constructor's `defaultName`. */
  readonly name?: string;
  /** Optional model override. Default: the constructor's `defaultModel`. */
  readonly model?: string;
  /** Optional pre-configured `HttpTransport`. Default: `FetchHttpTransport`. */
  readonly transport?: HttpTransport;
  /** Optional per-request timeout. Composed with the caller's `signal`. */
  readonly timeoutMs?: number;
  /**
   * Optional retry budget. Captured for API symmetry with the
   * embedding providers; **not used in Phase 4** — the base class
   * does not retry. Callers compose retries at the `HttpTransport`
   * boundary. The field exists so the public option surface is
   * stable when retries are added in a future phase.
   */
  readonly maxRetries?: number;
  /** Default `name` if the caller does not supply one. */
  readonly defaultName: string;
  /** Default `model` if the caller does not supply one. */
  readonly defaultModel: string;
}

function toKernelError(err: unknown, provider: string): KernelError {
  if (err instanceof KernelError) return err;
  if (err instanceof Error && err.name === "AbortError") {
    return makeAbortError();
  }
  return new KernelError("upstream", `${provider} request failed: ${String(err)}`, { cause: err });
}

function makeAbortError(): KernelError {
  const err = new KernelError("internal", "Request was aborted");
  err.name = "AbortError";
  return err;
}

function truncate(s: string, n: number): string {
  return s.length <= n ? s : `${s.slice(0, n)}…`;
}
