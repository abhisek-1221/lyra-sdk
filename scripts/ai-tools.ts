import { config } from "dotenv";
import { createAITools } from "../packages/core/src/ai-tools/index.js";

config();

const YT_KEY = process.env.YOUTUBE_API_KEY;
const GEMINI_KEY = process.env.GOOGLE_GENERATIVE_AI_API_KEY;

if (!YT_KEY) {
  console.error("Error: YOUTUBE_API_KEY not set. Add it to your .env or export it.");
  process.exit(1);
}
if (!GEMINI_KEY) {
  console.error("Error: GOOGLE_GENERATIVE_AI_API_KEY not set. Add it to your .env or export it.");
  process.exit(1);
}

const ai = createAITools({ apiKey: YT_KEY });

const prompt = process.argv[2];
if (!prompt) {
  console.error("Usage: npx tsx scripts/ai-tools.ts '<your prompt>'");
  console.error('Example: npx tsx scripts/ai-tools.ts "What is the title of dQw4w9WgXcQ?"');
  process.exit(1);
}

console.log("\n=== Lyra AI Tools ===\n");
console.log(`Prompt: ${prompt}\n`);
console.log("Working...\n");

async function main() {
  const { generateText, tool } = await import("ai");
  const { google } = await import("@ai-sdk/google");

  const tools = {
    getVideo: tool(ai.getVideo),
    getVideos: tool(ai.getVideos),
    getChannel: tool(ai.getChannel),
    getChannelVideos: tool(ai.getChannelVideos),
    getPlaylist: tool(ai.getPlaylist),
    getPlaylistInfo: tool(ai.getPlaylistInfo),
    getPlaylistVideos: tool(ai.getPlaylistVideos),
    getComments: tool(ai.getComments),
    getTopComments: tool(ai.getTopComments),
    searchComments: tool(ai.searchComments),
    transcribeVideo: tool(ai.transcribeVideo),
    batchTranscribe: tool(ai.batchTranscribe),
  };

  const result = await generateText({
    model: google("gemini-2.5-flash"),
    system:
      "You are a YouTube research assistant. Use the tools provided to answer questions about YouTube videos, channels, playlists, comments, and transcripts. Always call the relevant tool before answering.",
    tools,
    prompt,
    maxSteps: 15,
    onStepFinish({ text, toolCalls, toolResults, finishReason }) {
      console.log(
        `  [step] reason: ${finishReason}, text: ${text?.slice(0, 80) ?? "(none)"}, calls: ${toolCalls?.length ?? 0}`
      );
      for (let i = 0; i < (toolCalls?.length ?? 0); i++) {
        const tc = toolCalls![i];
        const tr = toolResults?.[i];
        console.log(`    tool: ${tc?.toolName}, args: ${JSON.stringify(tc?.args)?.slice(0, 80)}`);
        console.log(`    result: ${tr?.result ? "data present" : "(empty)"}`);
      }
    },
  });

  console.log("\n--- Agent Response ---\n");
  console.log(result.text || "(empty)");
  console.log(`\n(Steps: ${result.steps?.length ?? 0})`);
  console.log(`Finish reason: ${result.finishReason}`);
  console.log(`Tool calls: ${result.toolCalls?.length ?? 0}`);
  for (const tc of result.toolCalls ?? []) {
    console.log(`  ${tc.toolName}:`, JSON.stringify(tc.args)?.slice(0, 100));
  }
  console.log(`Tool results: ${result.toolResults?.length ?? 0}`);
  for (const tr of result.toolResults ?? []) {
    console.log(`  data:`, tr.result ? JSON.stringify(tr.result).slice(0, 80) : "(empty)");
  }
}

main().catch((err) => {
  console.error("Agent error:", err);
  process.exit(1);
});
