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
  console.log("Fetching playlist info: PLrAXtmErZgOeiKm4sgNOknGvNjby9efdf\n");

  const info = await client.playlistInfo("PLrAXtmErZgOeiKm4sgNOknGvNjby9efdf");

  console.log("Title:", info.title);
  console.log("Description:", info.description);
  console.log("\nThumbnails:");
  console.log("  Default:", info.thumbnails.default.url);
  console.log("  Medium:", info.thumbnails.medium.url);
  console.log("  High:", info.thumbnails.high.url);
}

main().catch(console.error);
