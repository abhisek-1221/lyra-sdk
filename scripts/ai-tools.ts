import { config } from "dotenv";
import { createAITools, vercelTool } from "../packages/core/src/ai-tools/index.js";

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

const tools = {
  getVideo: vercelTool(ai.getVideo),
  getVideos: vercelTool(ai.getVideos),
  getChannel: vercelTool(ai.getChannel),
  getChannelVideos: vercelTool(ai.getChannelVideos),
  getPlaylist: vercelTool(ai.getPlaylist),
  getPlaylistInfo: vercelTool(ai.getPlaylistInfo),
  getPlaylistVideos: vercelTool(ai.getPlaylistVideos),
  getComments: vercelTool(ai.getComments),
  getTopComments: vercelTool(ai.getTopComments),
  searchComments: vercelTool(ai.searchComments),
  transcribeVideo: vercelTool(ai.transcribeVideo),
  batchTranscribe: vercelTool(ai.batchTranscribe),
};

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
  const { generateText } = await import("ai");
  const { google } = await import("@ai-sdk/google");

  const result = await generateText({
    model: google("gemini-2.5-flash"),
    system:
      "You are a YouTube research assistant. Use the tools provided to answer questions about YouTube videos, channels, playlists, comments, and transcripts. Always call the relevant tool before answering.",
    tools,
    prompt,
    maxSteps: 15,
    onStepFinish({ text, toolCalls, toolResults, finishReason }) {
      console.log(`  [step] finishReason: ${finishReason}, text: ${text?.slice(0, 80) ?? "(none)"}, toolCalls: ${toolCalls?.length ?? 0}`);
    },
  });

  console.log("\n--- Agent Response ---\n");
  console.log(result.text || "(empty)");
  console.log(`\n(Steps: ${result.steps?.length ?? 0})`);
}

main().catch((err) => {
  console.error("Agent error:", err);
  process.exit(1);
});
