import { config } from "dotenv";

config();

import { yt } from "../packages/core/src/index.js";

const API_KEY = process.env.YOUTUBE_API_KEY;
if (!API_KEY) {
  console.error("YOUTUBE_API_KEY environment variable is required");
  process.exit(1);
}

const client = yt(API_KEY);

const PLAYLIST_ID = "PLinedj3B30sBlBWRox2V2tg9QJ2zr4M3o";

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
