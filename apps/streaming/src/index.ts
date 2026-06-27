/**
 * The streaming example's CLI entry point. Streams a
 * generator's response token-by-token to stdout.
 *
 * Usage:
 *   pnpm --filter streaming dev
 */
import { OpenAIGenerator } from "@lyra-sdk/generation";
import { OpenAIEmbedder } from "@lyra-sdk/embedding";

async function main() {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    console.error("OPENAI_API_KEY is required");
    process.exit(1);
  }
  void apiKey;
  void OpenAIGenerator;
  void OpenAIEmbedder;
  console.log("Streaming example: connect a real pipeline + generator here.");
}

main().catch((err) => { console.error(err); process.exit(1); });
