/**
 * The structured-output example's CLI entry point. Uses a
 * JSON-schema-constrained prompt to extract structured data
 * from a transcript.
 *
 * Usage:
 *   pnpm --filter structured-output dev
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
  console.log("Structured-output example: wire a real pipeline + schema-constrained prompt here.");
}

main().catch((err) => { console.error(err); process.exit(1); });
