import { config } from "dotenv";
config();
import { yt } from "lyra-sdk";

const client = yt(process.env.YOUTUBE_API_KEY!);

console.log("=== Testing Channel Functions ===\n");

// Test channel
console.log("--- channel info ---");
const channel = await client.channel("@MrBeast");
console.log("Name:", channel.name);
console.log("Username:", channel.username);
console.log("Subscribers:", channel.subscribers, `(${channel.subscribersFmt})`);
console.log("Total Views:", channel.totalViews, `(${channel.totalViewsFmt})`);
console.log("Video Count:", channel.videoCount);
console.log("Country:", channel.country);

// Test channelVideos
console.log("\n--- channelVideos (recent uploads) ---");
const recentVideos = await client.channelVideos("@MrBeast", { limit: 5 });
console.log("Recent uploads:");
for (const v of recentVideos) {
  console.log(`  - ${v.title} (${v.durationFmt}) - ${v.uploadAge}`);
}

console.log("\n✅ All channel tests passed!");
