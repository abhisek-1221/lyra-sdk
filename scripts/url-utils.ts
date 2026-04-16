import {
  parseURL,
  isVideoURL,
  isPlaylistURL,
} from "../packages/core/src/index.js";

const testUrls = [
  "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
  "https://youtu.be/dQw4w9WgXcQ",
  "https://www.youtube.com/embed/dQw4w9WgXcQ",
  "https://www.youtube.com/shorts/dQw4w9WgXcQ",
  "https://www.youtube.com/playlist?list=PLrAXtmErZgOeiKm4sgNOknGvNjby9efdf",
  "https://www.youtube.com/watch?v=dQw4w9WgXcQ&list=PLrAXtmErZgOeiKm4sgNOknGvNjby9efdf",
  "https://www.youtube.com/channel/UCX6OQ3DkcsbYNE6H8uQQuVA",
  "https://www.youtube.com/@MrBeast",
  "https://google.com/watch?v=abc",
  "not-a-url",
  "",
];

console.log("URL Utilities Test (no API key needed)\n");
console.log("=".repeat(60));

for (const url of testUrls) {
  const result = parseURL(url);
  console.log(`\nURL: ${url || "(empty)"}`);
  console.log(`  Valid: ${result.isValid}`);
  console.log(`  Type: ${result.type}`);
  if (result.videoId) console.log(`  Video ID: ${result.videoId}`);
  if (result.playlistId) console.log(`  Playlist ID: ${result.playlistId}`);
  if (result.channelId) console.log(`  Channel ID: ${result.channelId}`);
  if (result.error) console.log(`  Error: ${result.error}`);
}

console.log("\n" + "=".repeat(60));
console.log("\nisVideoURL tests:");
console.log(
  "  youtube.com/watch:",
  isVideoURL("https://www.youtube.com/watch?v=abc"),
);
console.log("  youtu.be:", isVideoURL("https://youtu.be/abc"));
console.log(
  "  playlist:",
  isVideoURL("https://www.youtube.com/playlist?list=PLxxx"),
);

console.log("\nisPlaylistURL tests:");
console.log(
  "  playlist:",
  isPlaylistURL("https://www.youtube.com/playlist?list=PLxxx"),
);
console.log(
  "  watch with list:",
  isPlaylistURL("https://www.youtube.com/watch?v=abc&list=PLxxx"),
);
console.log("  video:", isPlaylistURL("https://youtu.be/abc"));
