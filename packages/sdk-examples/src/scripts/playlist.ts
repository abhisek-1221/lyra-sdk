import { config } from "dotenv";

config();

import { yt } from "lyra-sdk";

const client = yt(process.env.YOUTUBE_API_KEY!);

console.log("=== Testing Playlist Functions ===\n");

// Test playlistInfo (lightweight, 1 quota unit)
console.log("--- playlistInfo (1 quota unit) ---");
const playlistId = "PLrAXtmErZgOeiKm4sgNOknGvNjby9efdf";
const info = await client.playlistInfo(playlistId);
console.log("Title:", info.title);
console.log("Description:", info.description);
console.log("Thumbnail:", info.thumbnails.high.url);

// Test playlistVideoIds (auto-pagination)
console.log("\n--- playlistVideoIds (auto-pagination) ---");
const videoIds = await client.playlistVideoIds(playlistId);
console.log("Video IDs count:", videoIds.length);
console.log("First 3 IDs:", videoIds.slice(0, 3));

// Test full playlist
console.log("\n--- Full playlist with all details ---");
const playlist = await client.playlist(playlistId);
console.log("Title:", playlist.title);
console.log("Video Count:", playlist.videoCount);
console.log("Total Duration:", playlist.totalDuration, `seconds (${playlist.totalDurationFmt})`);
console.log("\nVideos:");
for (const v of playlist.videos) {
  console.log(`  - ${v.title} (${v.durationFmt})`);
}

console.log("\n✅ All playlist tests passed!");
