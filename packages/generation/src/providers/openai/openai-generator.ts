import { KernelError } from "@lyra-sdk/kernel";
import type { HttpRequest, HttpResponse, HttpTransport } from "@lyra-sdk/embedding";
import { BaseHttpGenerator } from "../_shared/base-http-generator.js";
import { OpenAICompatibleMapper } from "../_shared/openai-compat/mapper.js";
import type { GenerationOptions } from "../../contracts/generation-options.js";
import type { GenerationRequest } from "../../contracts/generation-request.js";
import type { GenerationResponse } from "../../contracts/generation-response.js";
import { parseJsonResponse } from "../../structured/index.js";

/**
 * Options for {@link OpenAIGenerator}.
 *
 * Mirrors the `OpenAIEmbedderOptions` shape: required `apiKey`,
 * optional `model` override, optional `transport`, optional
 * `baseUrl` (for OpenAI-compatible gateways).
 */
export interface OpenAIGeneratorOptions {
  /** OpenAI API key. Required. */
  readonly apiKey: string;
  /** Model. Default: `gpt-4o-mini`. */
  readonly model?: string;
  /** Optional pre-configured `HttpTransport`. Default: `FetchHttpTransport`. */
  readonly transport?: HttpTransport;
  /** OpenAI API base. Default: `https://api.openai.com/v1`. */
  readonly baseUrl?: string;
  /** Optional per-request timeout. */
  readonly timeoutMs?: number;
  /** Optional name override. */
  readonly name?: string;
  /** Reserved for future use. */
  readonly maxRetries?: number;
}

/**
 * The OpenAI chat-completions generator. Uses the
 * `POST {baseUrl}/chat/completions` endpoint via an injected
 * `HttpTransport`. No SDK dependency.
 *
 * The provider sets `stream_options.include_usage: true` so the
 * server reports token usage in the final SSE chunk. The
 * `parseJsonResponse` helper is invoked for structured outputs.
 */
export class OpenAIGenerator extends BaseHttpGenerator {
  public readonly provider = "openai";
  protected readonly apiKey: string;
  protected readonly baseUrl: string;
  private readonly mapper: OpenAICompatibleMapper;

  constructor(options: OpenAIGeneratorOptions) {
    if (!options.apiKey) {
      throw new KernelError("invalid_argument", "OpenAIGenerator: apiKey is required");
    }
    super({
      ...(options.name !== undefined ? { name: options.name } : {}),
      ...(options.model !== undefined ? { model: options.model } : {}),
      ...(options.transport !== undefined ? { transport: options.transport } : {}),
      ...(options.timeoutMs !== undefined ? { timeoutMs: options.timeoutMs } : {}),
      ...(options.maxRetries !== undefined ? { maxRetries: options.maxRetries } : {}),
      defaultName: "OpenAIGenerator",
      defaultModel: "gpt-4o-mini",
    });
    this.apiKey = options.apiKey;
    this.baseUrl = options.baseUrl ?? "https://api.openai.com/v1";
    this.mapper = new OpenAICompatibleMapper("openai");
  }

  protected buildRequest(request: GenerationRequest, options?: GenerationOptions): HttpRequest {
    const body = this.mapper.buildBody(request.prompt, this.model, {
      ...(options?.temperature !== undefined ? { temperature: options.temperature } : {}),
      ...(options?.maxOutputTokens !== undefined ? { maxOutputTokens: options.maxOutputTokens } : {}),
      ...(options?.stopSequences !== undefined ? { stopSequences: options.stopSequences } : {}),
    });
    // OpenAI requires `stream_options.include_usage` to receive
    // token counts in the final chunk.
    const bodyWithUsage = { ...body, stream_options: { include_usage: true } };
    return {
      url: `${this.baseUrl}/chat/completions`,
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify(bodyWithUsage),
    };
  }

  protected parseStreamBody(response: HttpResponse): AsyncIterable<unknown> {
    return this.mapper.parseStreamBody(response);
  }

  protected mapEvent(event: unknown): { type: "text"; delta: string } | { type: "usage"; usage: { inputTokens: number; outputTokens: number } } | null {
    return this.mapper.mapEvent(event);
  }

  protected finalizeResponse(args: {
    request: GenerationRequest;
    text: string;
    usage: { inputTokens: number; outputTokens: number } | undefined;
    startedAt: number;
  }): GenerationResponse {
    const finishReason = this.mapper.readFinishReason();
    const diagnostics: Record<string, number> = { streamDurationMs: performance.now() - args.startedAt };
    let data: unknown;
    let parseError: string | undefined;
    if (args.request.prompt.schema !== undefined) {
      try {
        data = parseJsonResponse<unknown>(args.text, args.request.prompt.schema);
        diagnostics.structuredOutputMode = 1;
      } catch (err) {
        parseError = err instanceof Error ? err.message : String(err);
        diagnostics.parseError = 1;
      }
    }

    return {
      text: args.text,
      ...(data !== undefined ? { data } : {}),
      ...(args.usage ? { usage: args.usage } : {}),
      provider: this.provider,
      model: this.model,
      finishReason: parseError !== undefined ? "error" : finishReason,
      citations: [],
      durationMs: performance.now() - args.startedAt,
      diagnostics,
    };
  }
}
