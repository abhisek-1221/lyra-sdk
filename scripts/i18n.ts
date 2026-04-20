import { config } from "dotenv";
config();

import { yt } from "../packages/core/src/index.js";

const apiKey = process.env.YOUTUBE_API_KEY;
if (!apiKey) {
  console.error("Error: YOUTUBE_API_KEY not set in environment");
  process.exit(1);
}

const client = yt(apiKey);
const hl = process.argv[2] ?? undefined;

async function main() {
  console.log("=== I18n: Regions & Languages ===\n");

  console.log(`--- Supported regions${hl ? ` (hl=${hl})` : ""} ---\n`);
  const regions = await client.regions(hl);

  const columns = 3;
  for (let i = 0; i < regions.length; i += columns) {
    const row = regions.slice(i, i + columns).map((r) => `${r.gl} ${r.name}`.padEnd(28));
    console.log(" ", row.join(""));
  }
  console.log(`\nTotal: ${regions.length} regions`);

  console.log(`\n--- Supported languages${hl ? ` (hl=${hl})` : ""} ---\n`);
  const languages = await client.languages(hl);

  for (const lang of languages) {
    console.log(`  ${lang.hl.padEnd(12)} ${lang.name}`);
  }
  console.log(`\nTotal: ${languages.length} languages`);

  console.log("\n--- Combining with videoCategories ---\n");
  const firstRegion = regions[0];
  if (firstRegion) {
    console.log(`Fetching categories for region: ${firstRegion.gl} (${firstRegion.name})\n`);
    const categories = await client.videoCategoriesByRegion(firstRegion.gl);
    for (const cat of categories.slice(0, 5)) {
      const badge = cat.assignable ? "" : " (not assignable)";
      console.log(`  ${cat.id.padEnd(4)} ${cat.title}${badge}`);
    }
    if (categories.length > 5) {
      console.log(`  ... and ${categories.length - 5} more`);
    }
    console.log(`\nTotal: ${categories.length} categories`);
  }
}

main().catch(console.error);
