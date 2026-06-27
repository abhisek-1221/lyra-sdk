/**
 * The chat example's REPL entry point.
 *
 * Usage:
 *   pnpm --filter chat dev
 *
 * Reads transcripts from `./corpus.txt` (one transcript per
 * line, separated by blank lines), ingests them, then opens a
 * REPL. Each user turn is appended to a `Conversation` and
 * threaded through `pipeline.ask`; the assistant's response
 * is appended to the history.
 *
 * The example requires `OPENAI_API_KEY` in the environment. It
 * is the canonical first-thing-to-try application; smoke tests
 * exercise the same flow with a stub generator.
 */
import * as readline from "node:readline";
import { OpenAIGenerator } from "@lyra-sdk/generation";
import { OpenAIEmbedder } from "@lyra-sdk/embedding";
import { buildChatPipeline } from "./pipeline.js";
import type { PromptMessage } from "@lyra-sdk/prompt";

async function main() {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    console.error("OPENAI_API_KEY is required");
    process.exit(1);
  }

  const embedder = new OpenAIEmbedder({ apiKey });
  const generator = new OpenAIGenerator({ apiKey });
  const pipeline = buildChatPipeline({ embedder, generator });

  // Ingest a small corpus. In a real application the user
  // provides a YouTube URL; the example uses a static file.
  const corpus = ["the rain in spain falls mainly on the plain", "the model context protocol is a standard for context"];
  for (const text of corpus) {
    await pipeline.ingest({ meta: { videoId: "static" }, lines: [{ text, duration: 1, offset: 0, lang: "en" }] });
  }

  const history: PromptMessage[] = [];
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });

  for await (const line of rl) {
    const question = line.trim();
    if (question.length === 0) continue;
    if (question === ":exit") break;
    history.push({ role: "user", content: question });
    const result = await pipeline.ask({ query: question, conversation: { messages: history } });
    history.push({ role: "assistant", content: result.generation.text });
    console.log(`> ${result.generation.text}`);
  }
  pipeline.dispose();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
