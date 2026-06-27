import { KernelError } from "@lyra-sdk/kernel";
import type { HttpRequest, HttpResponse, HttpTransport } from "@lyra-sdk/embedding";
import { BaseHttpGenerator } from "../_shared/base-http-generator.js";
import type { Prompt } from "../../contracts/prompt.js";
import type { GenerationOptions } from "../../contracts/generation-options.js";
import type { GenerationRequest } from "../../contracts/generation-request.js";
import type { GenerationResponse } from "../../contracts/generation-response.js";
import { parseNdjsonBody } from "../../streaming/parse-ndjson.js";
import { parseJsonResponse } from "../../structured/index.js";

/**
 * Options for {@link OllamaGenerator}.
 */
export interface OllamaGeneratorOptions {
  /** Ollama model. Required. */
  readonly model: string;
  /** Optional pre-configured `HttpTransport`. Default: `FetchHttpTransport`. */
  readonly transport?: HttpTransport;
  /** Ollama API base. Default: `http://localhost:11434`. */
  readonly baseUrl?: string;
  /** Optional per-request timeout. */
  readonly timeoutMs?: number;
  /** Optional name override. */
  readonly name?: string;
  /** Reserved for future use. */
  readonly maxRetries?: number;
}

/** The Ollama `/api/chat` request body. */
interface OllamaRequestBody {
  readonly model: string;
  readonly messages: ReadonlyArray<{ role: "system" | "user" | "assistant"; content: string }>;
  readonly stream: true;
  readonly options?: {
    readonly temperature?: number;
    readonly num_predict?: number;
    readonly stop?: readonly string[];
  };
  readonly format?: unknown; // JSON schema object
}

/** A single Ollama streaming chunk. */
interface OllamaChunk {
  readonly model?: string;
  readonly message?: { readonly role?: string; readonly content?: string };
  readonly done?: boolean;
  readonly done_reason?: string;
  readonly prompt_eval_count?: number;
  readonly eval_count?: number;
  readonly total_duration?: number;
}

/**
 * The Ollama `/api/chat` generator. Uses NDJSON, not SSE. No
 * authentication. No SDK dependency.
 *
 * The wire format is similar to OpenAI's chat completions but
 * with `format` (a JSON schema) for structured outputs instead
 * of `response_format`. The `done` field on the final chunk
 * carries the usage fields.
 */
export class OllamaGenerator extends BaseHttpGenerator {
  public readonly provider = "ollama";
  protected readonly baseUrl: string;
  private inputTokens: number | undefined;
  private outputTokens: number | undefined;
  private lastDoneReason: string | undefined;

  constructor(options: OllamaGeneratorOptions) {
    if (!options.model) {
      throw new KernelError("invalid_argument", "OllamaGenerator: model is required");
    }
    super({
      ...(options.name !== undefined ? { name: options.name } : {}),
      model: options.model,
      ...(options.transport !== undefined ? { transport: options.transport } : {}),
      ...(options.timeoutMs !== undefined ? { timeoutMs: options.timeoutMs } : {}),
      ...(options.maxRetries !== undefined ? { maxRetries: options.maxRetries } : {}),
      defaultName: "OllamaGenerator",
      defaultModel: options.model,
    });
    this.baseUrl = options.baseUrl ?? "http://localhost:11434";
  }

  protected buildRequest(request: GenerationRequest, options?: GenerationOptions): HttpRequest {
    const body = this.buildBody(request.prompt, options);
    return {
      url: `${this.baseUrl}/api/chat`,
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    };
  }

  private buildBody(prompt: Prompt, options?: GenerationOptions): OllamaRequestBody {
    const messages: { role: "system" | "user" | "assistant"; content: string }[] = [];
    if (prompt.system.length > 0) messages.push({ role: "system", content: prompt.system });
    for (const m of prompt.messages) {
      messages.push({ role: m.role, content: m.content });
    }

    const opts: { temperature?: number; num_predict?: number; stop?: readonly string[] } = {};
    if (options?.temperature !== undefined) opts.temperature = options.temperature;
    if (options?.maxOutputTokens !== undefined) opts.num_predict = options.maxOutputTokens;
    if (options?.stopSequences !== undefined) opts.stop = options.stopSequences;

    const body: {
      model: string;
      messages: typeof messages;
      stream: true;
      options?: typeof opts;
      format?: unknown;
    } = { model: this.model, messages, stream: true };
    if (Object.keys(opts).length > 0) body.options = opts;
    if (prompt.schema !== undefined) body.format = prompt.schema;
    return body;
  }

  protected parseStreamBody(response: HttpResponse): AsyncIterable<unknown> {
    return (async function* () {
      for (const event of parseNdjsonBody<OllamaChunk>(response.bodyText)) yield event;
    })();
  }

  protected mapEvent(event: unknown): { type: "text"; delta: string } | { type: "usage"; usage: { inputTokens: number; outputTokens: number } } | null {
    if (event === null || event === undefined || typeof event !== "object") return null;
    const chunk = event as OllamaChunk;
    if (chunk.prompt_eval_count !== undefined) this.inputTokens = chunk.prompt_eval_count;
    if (chunk.eval_count !== undefined) this.outputTokens = chunk.eval_count;
    if (chunk.done_reason !== undefined) this.lastDoneReason = chunk.done_reason;
    if (chunk.done && this.inputTokens !== undefined && this.outputTokens !== undefined) {
      return { type: "usage", usage: { inputTokens: this.inputTokens, outputTokens: this.outputTokens } };
    }
    const text = chunk.message?.content;
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
    return {
      text: args.text,
      ...(data !== undefined ? { data } : {}),
      ...(args.usage ? { usage: args.usage } : {}),
      provider: this.provider,
      model: this.model,
      finishReason: parseError !== undefined ? "error" : mapOllamaFinishReason(this.lastDoneReason),
      citations: [],
      durationMs: performance.now() - args.startedAt,
      diagnostics,
    };
  }
}

function mapOllamaFinishReason(reason: string | undefined): "stop" | "length" | "tool_calls" | "content_filter" | "other" {
  switch (reason) {
    case "stop":
      return "stop";
    case "length":
      return "length";
    case "load":
      return "other";
    default:
      return "other";
  }
}
