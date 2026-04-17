# lyra-sdk

A lightweight YouTube Data API v3 helper library for Node.js.

## Installation

```bash
npm install lyra-sdk
```

## Quick Start

```typescript
import { yt } from "lyra-sdk";

const client = yt({ apiKey: process.env.YOUTUBE_API_KEY });

const video = await client.video("dQw4w9WgXcQ");
console.log(video.title, video.viewsFmt);

const playlist = await client.playlist("PLM1l8oW3aPfKDlqG4kKSyA9kqGszKqVYZ");
console.log(playlist.title, playlist.videoCount);
```

## Features

- **Videos**: Fetch metadata, statistics, and duration for any YouTube video
- **Playlists**: Get playlist info and all video IDs with pagination
- **Channels**: Fetch channel metadata and statistics
- **URL Utilities**: Parse and validate YouTube URLs
- **Playlist Query Builder**: Filter, sort, and slice playlist videos

## API Reference

### Client Setup

```typescript
import { yt } from "lyra-sdk";

const client = yt({
  apiKey: "your-api-key", // or set YOUTUBE_API_KEY env var
  language?: "en" | "es" | "ja" | ... // API hl parameter
});
```

### Video Operations

```typescript
// Get video by ID
const video = await client.video("dQw4w9WgXcQ");

// Parse URL to get video ID
const id = client.url.videoId("https://youtube.com/watch?v=dQw4w9WgXcQ");

// Check if URL is a video
const isVideo = client.url.isVideoURL("https://youtube.com/watch?v=...");
```

### Playlist Query Builder

The `playlistQuery()` method provides a fluent API for filtering, sorting, and slicing playlist videos:

```typescript
const result = await client
  .playlistQuery("PLM1l8oW3aPfKDlqG4kKSyA9kqGszKqVYZ")
  .filterByDuration({ min: 300 }) // Videos >= 5 minutes (seconds)
  .filterByViews({ min: 100_000 }) // Videos with >= 100k views
  .filterByLikes({ min: 1000 }) // Videos with >= 1k likes
  .sortBy("views", "desc") // Sort by views descending
  .between(1, 10) // Return first 10 results
  .execute();
```

#### Filter Methods

- `filterByDuration({ min?, max? })` - Filter by duration in seconds
- `filterByViews({ min?, max? })` - Filter by view count
- `filterByLikes({ min?, max? })` - Filter by like count

#### Sort Methods

- `sortBy(field, order)` - Sort by "duration", "views", or "likes"; order is "asc" or "desc"

#### Range Methods

- `between(start, end)` - Return videos in range (1-indexed, inclusive)

#### Response Shape

```typescript
interface PlaylistQueryResult {
  id: string;
  title: string;
  description: string;
  thumbnails: YTThumbnails;
  videos: PlaylistVideo[];
  videoCount: number; // Matched videos
  originalCount: number; // Total videos in playlist
  totalDuration: number; // Sum of durations (seconds)
  totalDurationFmt: string;
}

interface PlaylistVideo {
  id: string;
  title: string;
  description: string;
  channelTitle: string;
  publishedAt: Date;
  duration: number; // Seconds
  durationFmt: string; // e.g., "5:30"
  views: number;
  viewsFmt: string; // e.g., "1.2M"
  likes: number;
  likesFmt: string; // e.g., "45.6K"
  thumbnails: YTThumbnails;
}
```

### URL Utilities

```typescript
// Parse any YouTube URL
const parsed = client.url.parse("https://youtube.com/watch?v=...&list=...");
// { type: "video", id: "...", playlistId?: "..." }

// Check URL types
client.url.isVideoURL(url);
client.url.isPlaylistURL(url);

// Extract IDs
client.url.extractVideoId(url);
client.url.extractPlaylistId(url);
client.url.extractChannelId(url);
```

### Formatting Utilities

```typescript
import {
  formatNumber,
  formatDuration,
  formatDurationClock,
  relativeTime,
} from "lyra-sdk";

formatNumber(1_234_567); // "1.23M"
formatDuration(3661); // "1h 1m 1s"
formatDurationClock(3661); // "1:00:01"
relativeTime("2024-01-15T12:00:00Z"); // "3 months ago"
```

## Error Handling

```typescript
import { YTError, QuotaError, NotFoundError, AuthError } from "lyra-sdk";

try {
  const video = await client.video("invalid-id");
} catch (err) {
  if (err instanceof NotFoundError) {
    console.log("Video not found");
  } else if (err instanceof QuotaError) {
    console.log("API quota exceeded");
  } else if (err instanceof YTError) {
    console.log("YouTube API error:", err.message);
  }
}
```

## Scripts

Test scripts are located in the `scripts/` directory:

```bash
# Get video info
YOUTUBE_API_KEY=your-key npx tsx scripts/video.ts

# Get channel info
YOUTUBE_API_KEY=your-key npx tsx scripts/channel.ts

# Get playlist info
YOUTUBE_API_KEY=your-key npx tsx scripts/playlist.ts

# Get playlist videos (full)
YOUTUBE_API_KEY=your-key npx tsx scripts/playlist-videos.ts

# Parse YouTube URLs
YOUTUBE_API_KEY=your-key npx tsx scripts/url-utils.ts

# Run playlist query demo
YOUTUBE_API_KEY=your-key npx tsx scripts/playlist-query.ts
```

## Environment Variables

- `YOUTUBE_API_KEY` - Your YouTube Data API v3 key

## License

MIT
