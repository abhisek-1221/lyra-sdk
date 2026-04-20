import { config } from "dotenv";
config();

import { yt } from "../packages/core/src/index.js";

const apiKey = process.env.YOUTUBE_API_KEY;
if (!apiKey) {
  console.error("Error: YOUTUBE_API_KEY not set in environment");
  process.exit(1);
}

const client = yt(apiKey);
const regionCode = process.argv[2] ?? "US";

async function main() {
  console.log("=== Video Categories ===\n");

  console.log(`--- Categories for region: ${regionCode} ---\n`);
  const categories = await client.videoCategoriesByRegion(regionCode);

  for (const cat of categories) {
    const badge = cat.assignable ? "" : " (not assignable)";
    console.log(`  ${cat.id.padEnd(4)} ${cat.title}${badge}`);
  }

  console.log(`\nTotal: ${categories.length} categories`);

  console.log("\n--- Single category lookup (ID: 10) ---\n");
  const music = await client.videoCategory("10");
  console.log(`  ID:         ${music.id}`);
  console.log(`  Title:      ${music.title}`);
  console.log(`  Assignable: ${music.assignable}`);
  console.log(`  Channel:    ${music.channelId}`);

  console.log("\n--- Batch category lookup (IDs: 1, 10, 20) ---\n");
  const batch = await client.videoCategories(["1", "10", "20"]);
  for (const cat of batch) {
    console.log(`  ${cat.id}: ${cat.title}`);
  }
}

main().catch(console.error);
