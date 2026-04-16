import { config } from "dotenv";
config();
import { yt } from "lyra-sdk";

const client = yt(process.env.YOUTUBE_API_KEY!);

console.log("=== Testing Video Functions ===\n");

// Test single video
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

// Test videoTitle (lightweight)
console.log("\n--- Testing videoTitle (lightweight, 1 quota unit) ---");
const title = await client.videoTitle("dQw4w9WgXcQ");
console.log("Video title:", title);

console.log("\n✅ All video tests passed!");
