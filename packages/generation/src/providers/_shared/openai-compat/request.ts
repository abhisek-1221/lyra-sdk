import type { JSONSchema, Prompt, PromptMessage } from "../../../contracts/prompt.js";

/** A single message in the OpenAI `chat/completions` wire format. */
export interface OpenAiChatMessage {
  readonly role: "system" | "user" | "assistant";
  readonly content: string;
}

/** The OpenAI `chat/completions` request body. */
export interface OpenAiChatRequestBody {
  readonly model: string;
  readonly messages: readonly OpenAiChatMessage[];
  readonly temperature?: number;
  readonly max_tokens?: number;
  readonly stop?: readonly string[];
  readonly stream: true;
  readonly response_format?: OpenAiResponseFormat;
}

/** The `response_format` field for structured outputs. */
export interface OpenAiResponseFormat {
  readonly type: "json_schema";
  readonly json_schema: {
    readonly name: string;
    readonly schema: JSONSchema;
    readonly strict: true;
  };
}

/** A single choice in the OpenAI streaming response. */
export interface OpenAiChatChunk {
  readonly id?: string;
  readonly model?: string;
  readonly choices?: ReadonlyArray<{
    readonly index: number;
    readonly delta: { readonly content?: string | null; readonly role?: "assistant" };
    readonly finish_reason?: string | null;
  }>;
  readonly usage?: {
    readonly prompt_tokens?: number;
    readonly completion_tokens?: number;
  };
}

/**
 * Build an OpenAI `chat/completions` request body from a `Prompt`.
 *
 * Maps the prompt's `messages` field 1:1 (OpenAI uses
 * `system`/`user`/`assistant` roles). The `system` field is
 * prepended as a leading `system` message so the provider always
 * sees a consistent shape, even if the caller did not put a
 * system message first.
 */
export function buildOpenAiRequestBody(
  prompt: Prompt,
  model: string,
  options: { temperature?: number; maxOutputTokens?: number; stopSequences?: readonly string[] } = {},
): OpenAiChatRequestBody {
  const messages: OpenAiChatMessage[] = [];
  if (prompt.system.length > 0) {
    messages.push({ role: "system", content: prompt.system });
  }
  for (const m of prompt.messages) {
    messages.push({ role: m.role, content: m.content });
  }

  const body: {
    model: string;
    messages: readonly OpenAiChatMessage[];
    temperature?: number;
    max_tokens?: number;
    stop?: readonly string[];
    stream: true;
    response_format?: OpenAiResponseFormat;
  } = { model, messages, stream: true };

  if (options.temperature !== undefined) body.temperature = options.temperature;
  if (options.maxOutputTokens !== undefined) body.max_tokens = options.maxOutputTokens;
  if (options.stopSequences !== undefined) body.stop = options.stopSequences;

  if (prompt.schema !== undefined) {
    body.response_format = {
      type: "json_schema",
      json_schema: {
        name: readSchemaTitle(prompt.schema) ?? "response",
        schema: prompt.schema,
        strict: true,
      },
    };
  }

  return body;
}

function readSchemaTitle(schema: JSONSchema): string | undefined {
  const t = (schema as { title?: unknown }).title;
  return typeof t === "string" ? t : undefined;
}

/** The `finish_reason` string OpenAI returns. */
export type OpenAiFinishReason = "stop" | "length" | "tool_calls" | "content_filter";

/** Map an OpenAI `finish_reason` to the generator's `finishReason`. */
export function mapOpenAiFinishReason(reason: string | null | undefined): "stop" | "length" | "tool_calls" | "content_filter" | "other" {
  switch (reason) {
    case "stop":
    case "length":
    case "tool_calls":
    case "content_filter":
      return reason;
    default:
      return "other";
  }
}

export type { Prompt, PromptMessage };
