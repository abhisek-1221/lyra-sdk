import { CharHeuristicTokenCounter, type TokenCounter } from "@lyra-sdk/context";
import type { Prompt } from "./prompt.js";
import type { Conversation } from "./conversation.js";
import type { CitationFormat } from "../templates/citation-format.js";
import type { PromptTemplate } from "../templates/prompt-template.js";
import { DefaultPromptTemplate } from "../templates/default-prompt-template.js";
import type { PromptBuildArgs, PromptBuilder } from "./prompt-builder.js";

/**
 * The default `PromptBuilder`. Renders every `ContextChunk`
 * through the supplied template, joins them with a `Context:`
 * block, wraps the user's query in a `Question:` block, and
 * emits a final `Prompt` with the system + user messages.
 *
 * The builder **does not** mutate the input `Context` or
 * `Conversation`. It produces a fresh `messages[]` array.
 */
export class DefaultPromptBuilder implements PromptBuilder {
  private readonly counter: TokenCounter;
  private readonly template: PromptTemplate;
  private readonly defaultCitationFormat: CitationFormat;

  constructor(options: DefaultPromptBuilderOptions = {}) {
    this.counter = options.tokenCounter ?? new CharHeuristicTokenCounter();
    this.template = options.template ?? new DefaultPromptTemplate();
    this.defaultCitationFormat = options.citationFormat ?? ((i) => `[${i + 1}]`);
  }

  public build(args: PromptBuildArgs): Prompt {
    const system = args.system ?? this.template.system;
    const cite = args.citationFormat ?? this.defaultCitationFormat;

    const rendered = args.context.chunks.map((chunk, i) => this.template.formatChunk(chunk, i, cite));
    const userText = this.template.formatUser({
      query: args.query,
      rendered,
      truncated: args.context.truncated,
    });

    const messages = buildMessages(args.conversation, system, userText);
    const fullText = messages.map((m) => m.content).join("\n\n");

    return {
      system,
      messages,
      estimatedInputTokens: this.counter.count(fullText),
    };
  }
}

/** Build a fresh `messages[]` array from the conversation
 *  history and the new turn. The function never mutates
 *  `conversation.messages`. */
function buildMessages(
  conversation: Conversation | undefined,
  system: string,
  userText: string,
): readonly { role: "system" | "user" | "assistant"; content: string }[] {
  const messages: { role: "system" | "user" | "assistant"; content: string }[] = [];
  if (conversation) {
    for (const m of conversation.messages) {
      messages.push(m);
    }
  }
  messages.push({ role: "system", content: system });
  messages.push({ role: "user", content: userText });
  return messages;
}

export interface DefaultPromptBuilderOptions {
  /** Counter for tokens. Default: `CharHeuristicTokenCounter`. */
  readonly tokenCounter?: TokenCounter;
  /** Wording source. Default: `new DefaultPromptTemplate()`. */
  readonly template?: PromptTemplate;
  /** Default citation marker when the caller does not supply one. */
  readonly citationFormat?: CitationFormat;
}
