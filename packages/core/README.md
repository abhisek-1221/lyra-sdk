# lyra-sdk

YouTube Data API v3 in a few lines. No boilerplate, no pagination headaches.

## Features

- **Playlist-first** — Auto-paginates past YouTube's 50-item limit, batch video details in parallel
- **URL-first** — Pass full URL or bare ID to any method
- **Typed everything** — Full TypeScript, no `any`
- **Formatted by default** — Every numeric field has `*Fmt` companion (`viewsFmt`, `durationFmt`, etc.)
- **Tree-shakeable** — ESM + CJS dual build, standalone `lyra-sdk/url` and `lyra-sdk/fmt` exports
- **Zero dependencies** — Only uses native `fetch` API (Node 18+)

## Installation

```bash
npm install lyra-sdk
```

## Quick Start

```ts
import { yt } from "lyra-sdk";

const client = yt("YOUR_API_KEY");

// Fetch a video
const video = await client.video("https://youtu.be/dQw4w9WgXcQ");
console.log(video.title); // "Rick Astley - Never Gonna Give You Up"
console.log(video.viewsFmt); // "1.2B"

// Fetch a playlist (auto-paginates through all videos)
const playlist = await client.playlist(
  "https://youtube.com/playlist?list=PLxxx",
);
console.log(playlist.videoCount); // 142
console.log(playlist.totalDurationFmt); // "2d 5h 32m"

// Fetch channel
const channel = await client.channel("@MrBeast");
console.log(channel.subscribersFmt); // "355M"
```

## API

### Client Methods

#### Videos

```ts
client.video(urlOrId); // Fetch single video
client.videos(urlOrIds); // Batch fetch videos (chunks of 50)
client.videoTitle(urlOrId); // Lightweight title-only (1 quota unit)
client.videoTitles(urlOrIds); // Batch titles
```

#### Channels

```ts
client.channel(urlOrId); // Fetch channel metadata
client.channelVideos(urlOrId); // Fetch recent uploads
client.channelVideos(urlOrId, { limit: 10 }); // Custom limit (max 50)
```

#### Playlists

```ts
client.playlist(urlOrId); // Full playlist with auto-pagination
client.playlistInfo(urlOrId); // Metadata only (1 quota unit)
client.playlistVideoIds(urlOrId); // Just video IDs
```

### URL Utilities (No API Calls)

```ts
client.url.parse(url); // Parse any YouTube URL
client.url.isVideo(url); // Check if URL is a video
client.url.isPlaylist(url); // Check if URL is a playlist
client.url.extractVideoId(url); // Extract video ID
client.url.extractPlaylistId(url); // Extract playlist ID
client.url.extractChannelId(url); // Extract channel ID
```

### Standalone Exports

```ts
import { parseURL, isVideoURL } from "lyra-sdk/url";
import { formatDuration, formatNumber } from "lyra-sdk/fmt";
```

## Error Handling

```ts
import { yt, NotFoundError, QuotaError, AuthError } from "lyra-sdk";

try {
  const video = await client.video("invalid-id");
} catch (err) {
  if (err instanceof NotFoundError) {
    console.log("Video not found");
  } else if (err instanceof QuotaError) {
    console.log("API quota exceeded");
  } else if (err instanceof AuthError) {
    console.log("Invalid API key");
  }
}
```

## TypeScript

`lyra-sdk` is written in TypeScript and ships with full type definitions.

```ts
import { yt } from "lyra-sdk";
import type { Video, Playlist, Channel } from "lyra-sdk";

const video: Video = await client.video("dQw4w9WgXcQ");
```

## License

MIT
