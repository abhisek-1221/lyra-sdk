import { config } from "dotenv";

config();

import {
  extractChannelId,
  extractPlaylistId,
  extractUsername,
  extractVideoId,
  formatDate,
  formatDuration,
  formatDurationClock,
  formatNumber,
  isPlaylistURL,
  isVideoURL,
  parseDuration,
  parseURL,
  relativeTime,
} from "../packages/core/src/index.js";

console.log("=== URL Utilities ===\n");

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

console.log("parseURL tests:");
for (const url of testUrls) {
  const result = parseURL(url);
  console.log(`  ${url || "(empty)"}: ${result.isValid ? result.type : result.error}`);
}

console.log("\nisVideoURL / isPlaylistURL:");
console.log("  isVideoURL(youtu.be):", isVideoURL("https://youtu.be/abc"));
console.log("  isVideoURL(playlist):", isVideoURL("https://www.youtube.com/playlist?list=PLxxx"));
console.log(
  "  isPlaylistURL(playlist):",
  isPlaylistURL("https://www.youtube.com/playlist?list=PLxxx")
);
console.log("  isPlaylistURL(video):", isPlaylistURL("https://youtu.be/abc"));

console.log("\n=== URL Pattern Extraction ===\n");

const extractTestCases = [
  { label: "watch URL", url: "https://www.youtube.com/watch?v=dQw4w9WgXcQ" },
  { label: "short URL", url: "https://youtu.be/dQw4w9WgXcQ" },
  { label: "embed URL", url: "https://www.youtube.com/embed/dQw4w9WgXcQ" },
  { label: "shorts URL", url: "https://www.youtube.com/shorts/dQw4w9WgXcQ" },
  {
    label: "playlist URL",
    url: "https://www.youtube.com/playlist?list=PLtest123",
  },
  { label: "channel URL", url: "https://www.youtube.com/channel/UCtest123" },
  { label: "@username URL", url: "https://www.youtube.com/@MrBeast" },
];

console.log("extractVideoId:");
for (const tc of extractTestCases) {
  const id = extractVideoId(tc.url);
  console.log(`  ${tc.label}: ${id}`);
}

console.log("\nextractPlaylistId:");
for (const tc of extractTestCases) {
  const id = extractPlaylistId(tc.url);
  if (id) console.log(`  ${tc.label}: ${id}`);
}

console.log("\nextractChannelId:");
for (const tc of extractTestCases) {
  const id = extractChannelId(tc.url);
  if (id) console.log(`  ${tc.label}: ${id}`);
}

console.log("\nextractUsername:");
for (const tc of extractTestCases) {
  const username = extractUsername(tc.url);
  if (username) console.log(`  ${tc.label}: ${username}`);
}

console.log("\n=== Duration Utilities ===\n");

const durationTests = [
  { input: "PT1H23M45S", label: "1h 23m 45s" },
  { input: "PT10M30S", label: "10m 30s" },
  { input: "PT45S", label: "45s" },
  { input: "PT2H", label: "2 hours" },
  { input: "", label: "empty" },
];

console.log("parseDuration:");
for (const tc of durationTests) {
  const seconds = parseDuration(tc.input);
  console.log(`  ${tc.label}: ${seconds} seconds`);
}

console.log("\nformatDuration / formatDurationClock:");
const secondsTests = [0, 45, 90, 3661, 90061];
for (const sec of secondsTests) {
  console.log(`  ${sec}s → ${formatDuration(sec)} / ${formatDurationClock(sec)}`);
}

console.log("\n=== Format Utilities ===\n");

console.log("formatNumber:");
console.log("  1_500_000:", formatNumber(1_500_000));
console.log("  12_300:", formatNumber(12_300));
console.log("  42:", formatNumber(42));

console.log("\nformatDate:");
console.log("  2024-01-15T12:00:00Z:", formatDate("2024-01-15T12:00:00Z"));

console.log("\nrelativeTime:");
const now = new Date();
const oneHourAgo = new Date(now.getTime() - 3600000);
const twoDaysAgo = new Date(now.getTime() - 2 * 86400000);
console.log("  1 hour ago:", relativeTime(oneHourAgo));
console.log("  2 days ago:", relativeTime(twoDaysAgo));

console.log("\n✅ All utility function tests completed!");
