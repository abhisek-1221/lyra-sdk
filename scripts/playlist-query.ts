import { createRequire } from "node:module";
import { dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { config } from "dotenv";

config();

const __dirname = dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);

const { yt } = require("../packages/core/dist/index.cjs");

const API_KEY = process.env.YOUTUBE_API_KEY;
if (!API_KEY) {
  console.error("YOUTUBE_API_KEY environment variable is required");
  process.exit(1);
}

const client = yt({ apiKey: API_KEY });

const PLAYLIST_ID = "PLM1l8oW3aPfKDlqG4kKSyA9kqGszKqVYZ";

async function main() {
  console.log("=== Playlist Query Demo ===\n");

  const result = await client
    .playlistQuery(PLAYLIST_ID)
    .filterByDuration({ min: 5 * 60 })
    .filterByViews({ min: 100_000 })
    .sortBy("views", "desc")
    .between(1, 10)
    .execute();

  console.log(`Playlist: ${result.title}`);
  console.log(`Videos: ${result.videoCount} of ${result.originalCount} matched\n`);

  for (const video of result.videos) {
    console.log(`  [${video.durationFmt}] ${video.title}`);
    console.log(`    Views: ${video.viewsFmt} | Likes: ${video.likesFmt}`);
  }

  console.log(`\nTotal duration: ${result.totalDurationFmt}`);
}

main().catch(console.error);
