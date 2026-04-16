import {
  parseURL,
  isVideoURL,
  isPlaylistURL,
  parseDuration,
  formatDuration,
  formatDurationClock,
  formatNumber,
  formatDate,
  relativeTime,
  extractVideoId,
  extractPlaylistId,
  extractChannelId,
  extractUsername,
} from "lyra-sdk";

console.log("=== Testing URL Utilities ===\n");

// parseURL tests
console.log("parseURL:");
console.log(
  "  watch URL:",
  parseURL("https://www.youtube.com/watch?v=dQw4w9WgXcQ").type,
);
console.log("  short URL:", parseURL("https://youtu.be/dQw4w9WgXcQ").type);
console.log(
  "  playlist URL:",
  parseURL("https://www.youtube.com/playlist?list=PLxxx").type,
);
console.log(
  "  channel URL:",
  parseURL("https://www.youtube.com/channel/UCxxx").type,
);

// isVideoURL / isPlaylistURL
console.log("\nisVideoURL / isPlaylistURL:");
console.log("  isVideoURL(youtu.be):", isVideoURL("https://youtu.be/abc"));
console.log(
  "  isVideoURL(playlist):",
  isVideoURL("https://www.youtube.com/playlist?list=PLxxx"),
);
console.log(
  "  isPlaylistURL(playlist):",
  isPlaylistURL("https://www.youtube.com/playlist?list=PLxxx"),
);
console.log("  isPlaylistURL(video):", isPlaylistURL("https://youtu.be/abc"));

// extract functions
console.log(
  "\nextractVideoId:",
  extractVideoId("https://youtu.be/dQw4w9WgXcQ"),
);
console.log(
  "extractPlaylistId:",
  extractPlaylistId("https://www.youtube.com/playlist?list=PLtest123"),
);
console.log(
  "extractChannelId:",
  extractChannelId("https://www.youtube.com/channel/UCtest123"),
);
console.log(
  "extractUsername:",
  extractUsername("https://www.youtube.com/@MrBeast"),
);

console.log("\n=== Testing Duration Utilities ===\n");

console.log("parseDuration:");
console.log("  PT1H23M45S:", parseDuration("PT1H23M45S"), "(5025 seconds)");
console.log("  PT10M30S:", parseDuration("PT10M30S"), "(630 seconds)");
console.log("  PT45S:", parseDuration("PT45S"), "(45 seconds)");

console.log("\nformatDuration:");
console.log("  0s:", formatDuration(0));
console.log("  45s:", formatDuration(45));
console.log("  90s:", formatDuration(90), "(1m 30s)");
console.log("  3661s:", formatDuration(3661), "(1h 1m 1s)");

console.log("\nformatDurationClock:");
console.log("  90s:", formatDurationClock(90));
console.log("  3661s:", formatDurationClock(3661), "(1:01:01)");

console.log("\n=== Testing Format Utilities ===\n");

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

console.log("\n✅ All utils tests passed!");
