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
  console.log("Fetching channel: @MrBeast\n");

  const channel = await client.channel("@MrBeast");

  console.log("Name:", channel.name);
  console.log("Username:", channel.username);
  console.log(
    "Subscribers:",
    channel.subscribers,
    `(${channel.subscribersFmt})`,
  );
  console.log("Total Views:", channel.totalViews, `(${channel.totalViewsFmt})`);
  console.log("Video Count:", channel.videoCount);
  if (channel.country) console.log("Country:", channel.country);
}

main().catch(console.error);
