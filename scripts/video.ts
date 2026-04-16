import "dotenv/config";
import { yt } from "../packages/core/src/index.js";

const apiKey = process.env.YOUTUBE_API_KEY;
if (!apiKey) {
  console.error("Error: YOUTUBE_API_KEY not set in environment");
  console.error("Make sure .env file exists with YOUTUBE_API_KEY=value");
  process.exit(1);
}

const client = yt(apiKey);

async function main() {
  console.log("Fetching video: dQw4w9WgXcQ\n");

  const video = await client.video("dQw4w9WgXcQ");

  console.log("Title:", video.title);
  console.log("Channel:", video.channel);
  console.log("Views:", video.views, `(${video.viewsFmt})`);
  console.log("Likes:", video.likes, `(${video.likesFmt})`);
  console.log("Comments:", video.comments, `(${video.commentsFmt})`);
  console.log("Duration:", video.duration, `seconds (${video.durationFmt})`);
  console.log("Published:", video.published);
  console.log("\nThumbnails:");
  console.log("  Default:", video.thumbnails.default.url);
  console.log("  Medium:", video.thumbnails.medium.url);
  console.log("  High:", video.thumbnails.high.url);
}

main().catch(console.error);
