import { KernelError } from "@lyra-sdk/kernel";
import type { HttpRequest, HttpResponse, HttpTransport } from "@lyra-sdk/embedding";
import { BaseHttpGenerator } from "../_shared/base-http-generator.js";
import { OpenAICompatibleMapper } from "../_shared/openai-compat/mapper.js";
import type { GenerationOptions } from "../../contracts/generation-options.js";
import type { GenerationRequest } from "../../contracts/generation-request.js";
import type { GenerationResponse } from "../../contracts/generation-response.js";
import { parseJsonResponse } from "../../structured/index.js";

/**
 * Options for {@link OpenRouterGenerator}.
 */
export interface OpenRouterGeneratorOptions {
  /** OpenRouter API key. Required. */
  readonly apiKey: string;
  /** Model. Default: `anthropic/claude-3.5-sonnet`. */
  readonly model?: string;
  /** Optional pre-configured `HttpTransport`. Default: `FetchHttpTransport`. */
  readonly transport?: HttpTransport;
  /** OpenRouter API base. Default: `https://openrouter.ai/api/v1`. */
  readonly baseUrl?: string;
  /** Optional `HTTP-Referer` header (OpenRouter ranks apps that
   *  identify themselves higher on the leaderboard). */
  readonly appReferer?: string;
  /** Optional `X-Title` header. */
  readonly appTitle?: string;
  /** Optional per-request timeout. */
  readonly timeoutMs?: number;
  /** Optional name override. */
  readonly name?: string;
  /** Reserved for future use. */
  readonly maxRetries?: number;
}

/**
 * The OpenRouter generator. **Composition, not inheritance.**
 *
 * OpenRouter's wire format is identical to OpenAI's
 * `chat/completions` (the provider is a thin gateway in front
 * of multiple upstream models). We share the
 * `OpenAICompatibleMapper` with `OpenAIGenerator`; the only
 * differences are the `provider` string, the `baseUrl`, the
 * auth header style, and the optional `HTTP-Referer` /
 * `X-Title` headers.
 *
 * If OpenAI's wire format changes in the future, both
 * providers pick up the change via the shared mapper. The
 * alternative (subclassing `OpenAIGenerator`) would couple
 * OpenRouter to OpenAI's implementation details and would
 * inherit changes unintentionally.
 */
export class OpenRouterGenerator extends BaseHttpGenerator {
  public readonly provider = "openrouter";
  protected readonly apiKey: string;
  protected readonly baseUrl: string;
  protected readonly appReferer: string | undefined;
  protected readonly appTitle: string | undefined;
  private readonly mapper: OpenAICompatibleMapper;

  constructor(options: OpenRouterGeneratorOptions) {
    if (!options.apiKey) {
      throw new KernelError("invalid_argument", "OpenRouterGenerator: apiKey is required");
    }
    super({
      ...(options.name !== undefined ? { name: options.name } : {}),
      ...(options.model !== undefined ? { model: options.model } : {}),
      ...(options.transport !== undefined ? { transport: options.transport } : {}),
      ...(options.timeoutMs !== undefined ? { timeoutMs: options.timeoutMs } : {}),
      ...(options.maxRetries !== undefined ? { maxRetries: options.maxRetries } : {}),
      defaultName: "OpenRouterGenerator",
      defaultModel: "anthropic/claude-3.5-sonnet",
    });
    this.apiKey = options.apiKey;
    this.baseUrl = options.baseUrl ?? "https://openrouter.ai/api/v1";
    this.appReferer = options.appReferer;
    this.appTitle = options.appTitle;
    this.mapper = new OpenAICompatibleMapper("openrouter");
  }

  protected buildRequest(request: GenerationRequest, options?: GenerationOptions): HttpRequest {
    const body = this.mapper.buildBody(request.prompt, this.model, {
      ...(options?.temperature !== undefined ? { temperature: options.temperature } : {}),
      ...(options?.maxOutputTokens !== undefined ? { maxOutputTokens: options.maxOutputTokens } : {}),
      ...(options?.stopSequences !== undefined ? { stopSequences: options.stopSequences } : {}),
    });
    const headers: Record<string, string> = {
      "content-type": "application/json",
      authorization: `Bearer ${this.apiKey}`,
    };
    if (this.appReferer !== undefined) headers["HTTP-Referer"] = this.appReferer;
    if (this.appTitle !== undefined) headers["X-Title"] = this.appTitle;

    return {
      url: `${this.baseUrl}/chat/completions`,
      method: "POST",
      headers,
      body: JSON.stringify(body),
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
