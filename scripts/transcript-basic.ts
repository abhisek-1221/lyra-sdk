import { transcribeVideo, listCaptionTracks, toPlainText } from "../packages/core/src/modules/transcript.js";

const VIDEO_ID = "dQw4w9WgXcQ";

async function main() {
  console.log(`Fetching transcript for: ${VIDEO_ID}\n`);

  const lines = await transcribeVideo(VIDEO_ID);

  console.log(`Got ${(lines as Array<{ text: string }>).length} lines\n`);

  for (const line of lines as Array<{ text: string; offset: number; duration: number }>) {
    console.log(`[${line.offset.toFixed(1)}s] ${line.text}`);
  }

  console.log("\n--- Plain text output ---\n");
  console.log(toPlainText(lines as Array<{ text: string }>));
}

main().catch(console.error);
