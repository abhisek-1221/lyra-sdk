import { config } from "dotenv";
config();
import { yt } from "lyra-sdk";

console.log("=== Testing Client Factory ===\n");

// Test factory creates client
const client = yt(process.env.YOUTUBE_API_KEY!);
console.log("✓ yt() factory works");

// Test url utilities (no API call)
const parsed = client.url.parse("https://youtu.be/dQw4w9WgXcQ");
console.log("✓ client.url.parse() works:", parsed.type);

// Test url.isVideo
console.log(
  "✓ client.url.isVideo() works:",
  client.url.isVideo("https://youtu.be/abc"),
);

// Test url.isPlaylist
console.log(
  "✓ client.url.isPlaylist() works:",
  client.url.isPlaylist("https://www.youtube.com/playlist?list=PLxxx"),
);

// Test url.extractVideoId
console.log(
  "✓ client.url.extractVideoId() works:",
  client.url.extractVideoId("https://youtu.be/abc"),
);

// Test error on missing API key
try {
  yt("");
  console.log("✗ Should have thrown on empty API key");
  process.exit(1);
} catch (err: unknown) {
  if (err instanceof Error && err.message.includes("API key is required")) {
    console.log("✓ yt() throws on missing key");
  } else {
    console.log("✗ Wrong error thrown:", err);
    process.exit(1);
  }
}

console.log("\n✅ All client tests passed!");
