import { config } from "dotenv";

config();

import { yt } from "../packages/core/src/index.js";

const apiKey = process.env.YOUTUBE_API_KEY;
if (!apiKey) {
  console.error("Error: YOUTUBE_API_KEY not set in environment");
  console.error("Make sure .env file exists with YOUTUBE_API_KEY=value");
  process.exit(1);
}

const client = yt(apiKey);

async function main() {
  console.log("Fetching full playlist with auto-pagination...\n");

  const playlist = await client.playlist("PLrAXtmErZgOeiKm4sgNOknGvNjby9efdf");

  console.log("Title:", playlist.title);
  console.log("Video Count:", playlist.videoCount);
  console.log("Total Duration:", playlist.totalDuration, `seconds (${playlist.totalDurationFmt})`);
  console.log("\nFirst 5 videos:");

  for (const video of playlist.videos.slice(0, 5)) {
    console.log(`  - ${video.title}`);
    console.log(
      `    Duration: ${video.durationFmt} | Views: ${video.viewsFmt} | Likes: ${video.likesFmt}`
    );
  }

  if (playlist.videos.length > 5) {
    console.log(`  ... and ${playlist.videos.length - 5} more videos`);
  }
}

main().catch(console.error);
