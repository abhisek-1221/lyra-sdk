# lyra-sdk

[![npm version](https://img.shields.io/npm/v/lyra-sdk.svg)](https://www.npmjs.com/package/lyra-sdk)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](https://opensource.org/licenses/MIT)

A powerful TypeScript SDK for working with YouTube data. Fetch videos, channels, playlists, comments, and transcripts — all with full type safety and zero dependencies.

**🌐 Website:** [uselyra.xyz](https://uselyra.xyz)  
**📚 Documentation:** [docs.uselyra.xyz](https://docs.uselyra.xyz)

---

## Installation

```bash
npm install lyra-sdk
```

Requires Node.js 18+ and a [YouTube Data API v3 key](https://console.cloud.google.com/apis/credentials).

---

## Quick Start

```typescript
import { yt } from 'lyra-sdk'

const client = yt(process.env.YOUTUBE_API_KEY!)

// Fetch a video
const video = await client.video('dQw4w9WgXcQ')
console.log(video.title, video.viewsFmt)

// Fetch a channel by handle
const channel = await client.channel('@MrBeast')
console.log(channel.name, channel.subscribersFmt)

// Fetch a full playlist
const playlist = await client.playlist('PL...')
console.log(playlist.title, playlist.videoCount)
```

---

## Fetch Video Transcript (No API Key)

```typescript
import { transcribeVideo, toPlainText } from 'lyra-sdk/transcript'

const lines = await transcribeVideo('dQw4w9WgXcQ')
console.log(toPlainText(lines)) // Full transcript as plain text
```

The transcript module uses YouTube's internal Innertube API — **no quota consumption, no API key**.

---

## Transcribe Playlist (Batch)

```typescript
import { transcribePlaylist, InMemoryCache } from 'lyra-sdk'

const result = await transcribePlaylist('PL...', {
  apiKey: process.env.YOUTUBE_API_KEY!,
  concurrency: 5,
  cache: new InMemoryCache(),
  onProgress(done, total, videoId, status) {
    console.log(`[${status}] ${done}/${total} — ${videoId}`)
  },
})

console.log(`Succeeded: ${result.succeeded}, Failed: ${result.failed}`)
```

**Features:** concurrency control, smart caching, partial failure handling, range filtering.

---

## Comments & Comment Threads

```typescript
// Fetch all comment threads
const threads = await client.comments('dQw4w9WgXcQ')

// Top comments by relevance
const top5 = await client.topComments('dQw4w9WgXcQ', 5)

// All replies to a specific comment
const replies = await client.commentReplies('UgwSomeCommentId')

// Search comments by keyword
const results = await client.searchComments('dQw4w9WgXcQ', 'great song')

// Compute aggregate stats
const stats = client.commentStats('dQw4w9WgXcQ', threads)
console.log(`Unique authors: ${stats.uniqueAuthors}`)
```

---

## Playlist Query Builder

```typescript
const result = await client
  .playlistQuery('PL...')
  .filterByDuration({ min: 300 })
  .filterByViews({ min: 100_000 })
  .sortBy('views', 'desc')
  .between(1, 10)
  .execute()
```

---

## URL Utilities & Formatting (No API Key)

```typescript
import { parseURL, extractVideoId } from 'lyra-sdk/url'
import { formatNumber, formatDurationClock } from 'lyra-sdk/fmt'

parseURL('https://youtu.be/dQw4w9WgXcQ')
formatNumber(1_763_613_349) // '1.8B'
formatDurationClock(214)    // '3:34'
```

---

## Error Handling

```typescript
import { NotFoundError, QuotaError } from 'lyra-sdk'

try {
  const video = await client.video('invalid-id')
} catch (err) {
  if (err instanceof NotFoundError) console.log('Video not found')
  if (err instanceof QuotaError) console.log('API quota exceeded')
}
```

---

## Packages

| Package | Description |
|---------|-------------|
| `lyra-sdk` | Core SDK |
| `lyra-sdk/url` | Standalone URL utilities (no API key) |
| `lyra-sdk/fmt` | Standalone formatters (no API key) |
| `lyra-sdk/transcript` | Transcript fetching (no API key for single videos) |

---

## Documentation

Full docs, API reference, and examples: **[docs.uselyra.xyz](https://docs.uselyra.xyz)**

---

## License

MIT

---

<div align="center">

**If you find Lyra useful, please consider giving it a ⭐ on [GitHub](https://github.com/abhisek-1221/lyra-sdk)!**

</div>
