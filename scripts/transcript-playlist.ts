import { toPlainText, transcribePlaylist } from "../packages/core/src/modules/transcript.js";
import { config } from "dotenv";

config();

const API_KEY = process.env.YOUTUBE_API_KEY!;
const PLAYLIST_ID = process.argv[2] ?? "PLrAXtmErZgOeiKm4sgNOknGvNjby9efdf";

async function main() {
  console.log("=== Batch Transcript: Playlist ===\n");
  console.log(`Playlist: ${PLAYLIST_ID}\n`);

  const result = await transcribePlaylist(PLAYLIST_ID, {
    apiKey: API_KEY,
    concurrency: 3,
    onProgress(done, total, videoId, status) {
      const icon = status === "success" ? "+" : "x";
      console.log(`  [${icon}] ${done}/${total} — ${videoId}`);
    },
  });

  console.log(`\n--- Summary ---`);
  console.log(`Playlist ID:    ${result.playlistId}`);
  console.log(`Total videos:   ${result.totalVideos}`);
  console.log(`Range:          ${result.requestedRange[0]}–${result.requestedRange[1]}`);
  console.log(`Succeeded:      ${result.succeeded}`);
  console.log(`Failed:         ${result.failed}`);

  const first = result.results.find((r) => r.status === "success" && "lines" in r);
  if (first && "lines" in first) {
    console.log(`\n--- First 3 lines of "${first.title}" (${first.videoId}) ---\n`);
    console.log(toPlainText(first.lines.slice(0, 3)));
  }

  const failures = result.results.filter((r) => r.status === "failed");
  if (failures.length > 0) {
    console.log("\n--- Failed videos ---\n");
    for (const f of failures) {
      console.log(`  ${f.position}. ${f.videoId} — ${f.error}`);
    }
  }
}

main().catch(console.error);
