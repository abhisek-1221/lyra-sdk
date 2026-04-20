import {
  toPlainText,
  toSRT,
  toVTT,
  transcribeVideo,
} from "../packages/core/src/modules/transcript.js";

const VIDEO_ID = "dQw4w9WgXcQ";

async function main() {
  console.log(`Fetching transcript + metadata for: ${VIDEO_ID}\n`);

  const result = await transcribeVideo(VIDEO_ID, { includeMeta: true });

  if (!("meta" in result)) {
    console.error("Unexpected response: missing meta");
    process.exit(1);
  }

  const { meta, lines } = result;

  console.log("=== Video Metadata ===");
  console.log("Title:", meta.title);
  console.log("Author:", meta.author);
  console.log("Channel ID:", meta.channelId);
  console.log("Duration:", meta.lengthSeconds, "seconds");
  console.log("Views:", meta.viewCount);
  console.log("Description:", `${meta.description.slice(0, 120)}...`);
  console.log("Keywords:", meta.keywords.join(", "));
  console.log("Live:", meta.isLiveContent);
  console.log("Lines:", lines.length);

  console.log("\n=== First 3 lines ===\n");
  for (const line of lines.slice(0, 3)) {
    console.log(`[${line.offset.toFixed(1)}s] ${line.text}`);
  }

  console.log("\n=== SRT output (first 3 cues) ===\n");
  console.log(toSRT(lines.slice(0, 3)));

  console.log("\n=== VTT output (first 3 cues) ===\n");
  console.log(toVTT(lines.slice(0, 3)));

  console.log("\n=== Plain text (first 3 lines) ===\n");
  console.log(toPlainText(lines.slice(0, 3)));
}

main().catch(console.error);
