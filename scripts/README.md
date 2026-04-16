# Scripts

Test scripts for the lyra-sdk package. These scripts demonstrate how to use the SDK and verify it works correctly.

## Prerequisites

1. Copy `.env.example` to `.env`:

   ```bash
   cp .env.example .env
   ```

2. Add your YouTube Data API v3 key to `.env`:

   ```
   YOUTUBE_API_KEY=your_api_key_here
   ```

3. Get a YouTube API key from [Google Cloud Console](https://console.cloud.google.com)

## Running Scripts

**Important:** Scripts require environment variables to be loaded. Use this pattern:

```bash
# Load .env and run script in one command
export $(cat .env | grep -v '^#' | xargs) && npx tsx scripts/<script-name>.ts
```

Or alternatively:

```bash
# Set the variable directly
YOUTUBE_API_KEY=your_key_here npx tsx scripts/<script-name>.ts
```

## Available Scripts

### url-utils.ts

URL parsing utilities - no API key required.

```bash
source .env && npx tsx scripts/url-utils.ts
```

Tests URL parsing, extraction of video/playlist/channel IDs, and validation.

### video.ts

Fetch full details for a single video.

```bash
source .env && npx tsx scripts/video.ts
```

Fetches and displays video metadata including title, channel, views, likes, comments, duration, and thumbnails.

### playlist-info.ts

Fetch playlist metadata only (lightweight, 1 quota unit).

```bash
source .env && npx tsx scripts/playlist-info.ts
```

Fetches playlist title, description, and thumbnails.

### playlist-full.ts

Fetch complete playlist with all videos and auto-pagination.

```bash
source .env && npx tsx scripts/playlist-full.ts
```

Demonstrates:

- Auto-pagination through YouTube's 50-item limit
- Batch video detail enrichment
- Aggregated playlist statistics (total duration, video count)

### channel.ts

Fetch channel metadata.

```bash
source .env && npx tsx scripts/channel.ts
```

Fetches channel info including subscriber count, total views, and video count.

## Scripts That Need API Key

All scripts except `url-utils.ts` require `YOUTUBE_API_KEY` to be set in the environment.

If you see:

```
Error: YOUTUBE_API_KEY not set in environment
```

Make sure to run `source .env` before executing the script.
