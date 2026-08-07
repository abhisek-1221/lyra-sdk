import { KernelError } from "@lyra-sdk/kernel";
import type { HttpRequest, HttpResponse, HttpTransport } from "@lyra-sdk/embedding";
import { BaseHttpGenerator } from "../_shared/base-http-generator.js";
import type { JSONSchema, Prompt, PromptMessage } from "../../contracts/prompt.js";
import type { GenerationOptions } from "../../contracts/generation-options.js";
import type { GenerationRequest } from "../../contracts/generation-request.js";
import type { GenerationResponse } from "../../contracts/generation-response.js";
import { parseJsonResponse } from "../../structured/index.js";
import { parseSseBody } from "../../streaming/parse-sse.js";

/**
 * Options for {@link GeminiGenerator}.
 */
export interface GeminiGeneratorOptions {
  /** Gemini API key. Required. */
  readonly apiKey: string;
  /** Model. Default: `gemini-1.5-flash`. */
  readonly model?: string;
  /** Optional pre-configured `HttpTransport`. Default: `FetchHttpTransport`. */
  readonly transport?: HttpTransport;
  /** Gemini API base. Default: `https://generativelanguage.googleapis.com`. */
  readonly baseUrl?: string;
  /** Optional per-request timeout. */
  readonly timeoutMs?: number;
  /** Optional name override. */
  readonly name?: string;
  /** Reserved for future use. */
  readonly maxRetries?: number;
}

/** The Gemini `generateContent` request body. */
interface GeminiRequestBody {
  readonly contents: ReadonlyArray<{
    readonly role: "user" | "model";
    readonly parts: ReadonlyArray<{ text: string }>;
  }>;
  readonly systemInstruction?: { parts: ReadonlyArray<{ text: string }> };
  readonly generationConfig: {
    readonly temperature?: number;
    readonly maxOutputTokens?: number;
    readonly stopSequences?: readonly string[];
    readonly responseMimeType?: "application/json";
    readonly responseSchema?: JSONSchema;
  };
}

/** A single Gemini streaming chunk. */
interface GeminiChunk {
  readonly candidates?: ReadonlyArray<{
    readonly content?: { readonly parts?: ReadonlyArray<{ readonly text?: string }> };
    readonly finishReason?: string;
  }>;
  readonly usageMetadata?: {
    readonly promptTokenCount?: number;
    readonly candidatesTokenCount?: number;
  };
}

/**
 * The Gemini `generateContent` generator. Uses the
 * `POST {baseUrl}/v1beta/models/{model}:streamGenerateContent?alt=sse`
 * endpoint via an injected `HttpTransport`. No SDK dependency.
 *
 * The wire format differs from OpenAI: Gemini uses
 * `contents[]` with `parts[]` and a separate `systemInstruction`.
 * The provider maps the prompt accordingly.
 */
export class GeminiGenerator extends BaseHttpGenerator {
  public readonly provider = "gemini";
  protected readonly apiKey: string;
  protected readonly baseUrl: string;
  private inputTokens: number | undefined;
  private outputTokens: number | undefined;
  private lastFinishReason: string | undefined;

  constructor(options: GeminiGeneratorOptions) {
    if (!options.apiKey) {
      throw new KernelError("invalid_argument", "GeminiGenerator: apiKey is required");
    }
    super({
      ...(options.name !== undefined ? { name: options.name } : {}),
      ...(options.model !== undefined ? { model: options.model } : {}),
      ...(options.transport !== undefined ? { transport: options.transport } : {}),
      ...(options.timeoutMs !== undefined ? { timeoutMs: options.timeoutMs } : {}),
      ...(options.maxRetries !== undefined ? { maxRetries: options.maxRetries } : {}),
      defaultName: "GeminiGenerator",
      defaultModel: "gemini-1.5-flash",
    });
    this.apiKey = options.apiKey;
    this.baseUrl = options.baseUrl ?? "https://generativelanguage.googleapis.com";
  }

  protected buildRequest(request: GenerationRequest, options?: GenerationOptions): HttpRequest {
    const body = this.buildBody(request.prompt, options);
    return {
      url: `${this.baseUrl}/v1beta/models/${this.model}:streamGenerateContent?alt=sse`,
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-goog-api-key": this.apiKey,
      },
      body: JSON.stringify(body),
    };
  }

  private buildBody(prompt: Prompt, options?: GenerationOptions): GeminiRequestBody {
    const contents: { role: "user" | "model"; parts: { text: string }[] }[] = [];
    for (const m of prompt.messages) {
      if (m.role === "system") continue; // system goes into systemInstruction
      contents.push({ role: m.role === "assistant" ? "model" : "user", parts: [{ text: m.content }] });
    }

    const generationConfig: {
      temperature?: number;
      maxOutputTokens?: number;
      stopSequences?: readonly string[];
      responseMimeType?: "application/json";
      responseSchema?: JSONSchema;
    } = {};
    if (options?.temperature !== undefined) generationConfig.temperature = options.temperature;
    if (options?.maxOutputTokens !== undefined) generationConfig.maxOutputTokens = options.maxOutputTokens;
    if (options?.stopSequences !== undefined) generationConfig.stopSequences = options.stopSequences;

    if (prompt.schema !== undefined) {
      generationConfig.responseMimeType = "application/json";
      generationConfig.responseSchema = prompt.schema;
    }

    const body: {
      contents: typeof contents;
      systemInstruction?: { parts: { text: string }[] };
      generationConfig: typeof generationConfig;
    } = { contents, generationConfig };
    if (prompt.system.length > 0) {
      body.systemInstruction = { parts: [{ text: prompt.system }] };
    }
    return body;
  }

  protected parseStreamBody(response: HttpResponse): AsyncIterable<unknown> {
    return (async function* () {
      for (const event of parseSseBody(response.bodyText)) yield event;
    })();
  }

  protected mapEvent(event: unknown): { type: "text"; delta: string } | { type: "usage"; usage: { inputTokens: number; outputTokens: number } } | null {
    if (event === null || event === undefined || typeof event !== "object") return null;
    const e = event as { event: string; data: string };
    let parsed: GeminiChunk;
    try {
      parsed = JSON.parse(e.data) as GeminiChunk;
    } catch {
      return null;
    }

    if (parsed.usageMetadata) {
      if (parsed.usageMetadata.promptTokenCount !== undefined) this.inputTokens = parsed.usageMetadata.promptTokenCount;
      if (parsed.usageMetadata.candidatesTokenCount !== undefined) this.outputTokens = parsed.usageMetadata.candidatesTokenCount;
    }
    const candidate = parsed.candidates?.[0];
    if (candidate?.finishReason) this.lastFinishReason = candidate.finishReason;

    const text = candidate?.content?.parts?.[0]?.text;
    if (typeof text === "string" && text.length > 0) {
      return { type: "text", delta: text };
    }
    return null;
  }

  protected finalizeResponse(args: {
    request: GenerationRequest;
    text: string;
    usage: { inputTokens: number; outputTokens: number } | undefined;
    startedAt: number;
  }): GenerationResponse {
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
    const usage =
      args.usage ?? (this.inputTokens !== undefined && this.outputTokens !== undefined
        ? { inputTokens: this.inputTokens, outputTokens: this.outputTokens }
        : undefined);
    const finishReason = mapGeminiFinishReason(this.lastFinishReason);

    return {
      text: args.text,
      ...(data !== undefined ? { data } : {}),
      ...(usage ? { usage } : {}),
      provider: this.provider,
      model: this.model,
      finishReason: parseError !== undefined ? "error" : finishReason,
      citations: [],
      durationMs: performance.now() - args.startedAt,
      diagnostics,
    };
  }
}

function mapGeminiFinishReason(reason: string | undefined): "stop" | "length" | "tool_calls" | "content_filter" | "other" {
  switch (reason) {
    case "STOP":
      return "stop";
    case "MAX_TOKENS":
      return "length";
    case "SAFETY":
      return "content_filter";
    default:
      return "other";
  }
}

export type { Prompt, PromptMessage };
