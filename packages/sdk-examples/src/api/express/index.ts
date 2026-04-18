import { createApp } from "./app.js";

const PORT = Number(process.env.PORT) || 3000;

const app = createApp();

app.listen(PORT, () => {
  console.log(`lyra-sdk example API running at http://localhost:${PORT}`);
  console.log("\nEndpoints:");
  console.log("  GET  /api/video/:id            - Fetch video details");
  console.log("  GET  /api/videos?ids=id1,id2   - Batch fetch videos");
  console.log("  GET  /api/video/:id/title      - Lightweight title lookup");
  console.log("  GET  /api/channel/:id          - Fetch channel info");
  console.log("  GET  /api/channel/:id/videos   - Recent uploads (?limit=5)");
  console.log("  GET  /api/playlist/:id          - Full playlist with videos");
  console.log("  GET  /api/playlist/:id/info    - Playlist metadata only");
  console.log("  GET  /api/playlist/:id/ids     - Video IDs only");
  console.log("  POST /api/playlist/:id/query   - Filter/sort/range query");
  console.log("  POST /api/url/parse            - Parse YouTube URL");
  console.log("  POST /api/url/extract           - Extract IDs from URL");
});
