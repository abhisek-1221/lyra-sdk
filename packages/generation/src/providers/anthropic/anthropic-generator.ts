import { KernelError } from "@lyra-sdk/kernel";
import type { HttpRequest, HttpResponse, HttpTransport } from "@lyra-sdk/embedding";
import { BaseHttpGenerator } from "../_shared/base-http-generator.js";
import type { GenerationOptions } from "../../contracts/generation-options.js";
import type { GenerationRequest } from "../../contracts/generation-request.js";
import type { GenerationResponse } from "../../contracts/generation-response.js";
import { parseJsonResponse } from "../../structured/index.js";
import { parseSseBody } from "../../streaming/parse-sse.js";

/**
 * Options for {@link AnthropicGenerator}.
 */
export interface AnthropicGeneratorOptions {
  /** Anthropic API key. Required. */
  readonly apiKey: string;
  /** Model. Default: `claude-3-5-sonnet-latest`. */
  readonly model?: string;
  /** Optional pre-configured `HttpTransport`. Default: `FetchHttpTransport`. */
  readonly transport?: HttpTransport;
  /** Anthropic API base. Default: `https://api.anthropic.com`. */
  readonly baseUrl?: string;
  /** Anthropic API version. Default: `2023-06-01`. */
  readonly apiVersion?: string;
  /** Optional per-request timeout. */
  readonly timeoutMs?: number;
  /** Optional name override. */
  readonly name?: string;
  /** Reserved for future use. */
  readonly maxRetries?: number;
}

/** The Anthropic `/v1/messages` request body. */
// Local interface is built inline in `buildRequest`; no top-level
// type needed because the body is not exposed.

/**
 * The Anthropic `/v1/messages` generator. Uses the
 * `POST {baseUrl}/v1/messages` endpoint via an injected
 * `HttpTransport`. No SDK dependency.
 *
 * The wire format differs from OpenAI: Anthropic uses a
 * separate `system` field and a `messages[]` array of
 * `user`/`assistant` turns. The provider maps the prompt
 * accordingly.
 */
export class AnthropicGenerator extends BaseHttpGenerator {
  public readonly provider = "anthropic";
  protected readonly apiKey: string;
  protected readonly baseUrl: string;
  protected readonly apiVersion: string;
  private inputTokens: number | undefined;
  private outputTokens: number | undefined;
  private stopReason: string | undefined;

  constructor(options: AnthropicGeneratorOptions) {
    if (!options.apiKey) {
      throw new KernelError("invalid_argument", "AnthropicGenerator: apiKey is required");
    }
    super({
      ...(options.name !== undefined ? { name: options.name } : {}),
      ...(options.model !== undefined ? { model: options.model } : {}),
      ...(options.transport !== undefined ? { transport: options.transport } : {}),
      ...(options.timeoutMs !== undefined ? { timeoutMs: options.timeoutMs } : {}),
      ...(options.maxRetries !== undefined ? { maxRetries: options.maxRetries } : {}),
      defaultName: "AnthropicGenerator",
      defaultModel: "claude-3-5-sonnet-latest",
    });
    this.apiKey = options.apiKey;
    this.baseUrl = options.baseUrl ?? "https://api.anthropic.com";
    this.apiVersion = options.apiVersion ?? "2023-06-01";
  }

  protected buildRequest(request: GenerationRequest, options?: GenerationOptions): HttpRequest {
    const system = request.prompt.system;
    // Anthropic requires `max_tokens`. Default to 1024 if the
    // caller does not set `maxOutputTokens`.
    const maxTokens = options?.maxOutputTokens ?? 1024;
    const messages = request.prompt.messages
      .filter((m) => m.role === "user" || m.role === "assistant")
      .map((m) => ({ role: m.role as "user" | "assistant", content: m.content }));

    const body: {
      model: string;
      system: string;
      messages: ReadonlyArray<{ role: "user" | "assistant"; content: string }>;
      max_tokens: number;
      temperature?: number;
      stop_sequences?: readonly string[];
      stream: true;
    } = { model: this.model, system, messages, max_tokens: maxTokens, stream: true };

    if (options?.temperature !== undefined) body.temperature = options.temperature;
    if (options?.stopSequences !== undefined) body.stop_sequences = options.stopSequences;

    return {
      url: `${this.baseUrl}/v1/messages`,
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": this.apiKey,
        "anthropic-version": this.apiVersion,
      },
      body: JSON.stringify(body),
    };
  }

  protected parseStreamBody(response: HttpResponse): AsyncIterable<unknown> {
    return (async function* () {
      for (const event of parseSseBody(response.bodyText)) yield event;
    })();
  }

  protected mapEvent(event: unknown): { type: "text"; delta: string } | { type: "usage"; usage: { inputTokens: number; outputTokens: number } } | null {
    if (event === null || event === undefined || typeof event !== "object") return null;
    const e = event as { event: string; data: string };
    let parsed: { type?: unknown; [key: string]: unknown };
    try {
      parsed = JSON.parse(e.data) as { type?: unknown };
    } catch {
      return null;
    }
    if (parsed.type === "message_start") {
      const u = (parsed.message as { usage?: { input_tokens?: number; output_tokens?: number } } | undefined)?.usage;
      if (u?.input_tokens !== undefined) this.inputTokens = u.input_tokens;
      if (u?.output_tokens !== undefined) this.outputTokens = u.output_tokens;
      return null;
    }
    if (parsed.type === "content_block_delta") {
      const delta = parsed.delta as { type?: string; text?: string } | undefined;
      if (delta?.type === "text_delta" && typeof delta.text === "string") {
        return { type: "text", delta: delta.text };
      }
      return null;
    }
    if (parsed.type === "message_delta") {
      const delta = parsed.delta as { stop_reason?: string } | undefined;
      if (delta?.stop_reason !== undefined) this.stopReason = delta.stop_reason;
      const u = parsed.usage as { input_tokens?: number; output_tokens?: number } | undefined;
      if (u?.output_tokens !== undefined) this.outputTokens = u.output_tokens;
      if (this.inputTokens !== undefined && this.outputTokens !== undefined) {
        const usage = { inputTokens: this.inputTokens, outputTokens: this.outputTokens };
        return { type: "usage", usage };
      }
      return null;
    }
    return null;
  }

  protected finalizeResponse(args: {
    request: GenerationRequest;
    text: string;
    usage: { inputTokens: number; outputTokens: number } | undefined;
    startedAt: number;
  }): GenerationResponse {
    const finishReason = mapAnthropicFinishReason(this.stopReason);
    const diagnostics: Record<string, number> = { streamDurationMs: performance.now() - args.startedAt };
    if (args.request.prompt.schema !== undefined) diagnostics.structuredOutputMode = 2; // fallback marker
    let data: unknown;
    let parseError: string | undefined;
    if (args.request.prompt.schema !== undefined) {
      try {
        data = parseJsonResponse<unknown>(args.text, args.request.prompt.schema);
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

function mapAnthropicFinishReason(reason: string | undefined): "stop" | "length" | "tool_calls" | "content_filter" | "other" {
  switch (reason) {
    case "end_turn":
      return "stop";
    case "max_tokens":
      return "length";
    case "tool_use":
      return "tool_calls";
    case "stop_sequence":
      return "stop";
    case "refusal":
      return "content_filter";
    default:
      return "other";
  }
}
