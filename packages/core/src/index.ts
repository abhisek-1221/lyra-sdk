// ---------------------------------------------------------------------------
// lyra-sdk — Package entry point
// ---------------------------------------------------------------------------
//
//   import { yt } from "lyra-sdk"
//   const client = yt("YOUR_API_KEY")
//
// ---------------------------------------------------------------------------

import { YTClient } from "./client.js";
import type { YTOptions } from "./types.js";

/**
 * Create a YouTube Data API client.
 *
 * ```ts
 * import { yt } from "lyra-sdk"
 *
 * const client = yt("YOUR_API_KEY")
 * const video  = await client.video("dQw4w9WgXcQ")
 * ```
 */
export function yt(apiKey: string, options?: YTOptions): YTClient {
  if (!apiKey) {
    throw new Error(
      "lyra-sdk: API key is required. Get one at https://console.cloud.google.com",
    );
  }
  return new YTClient(apiKey, options);
}

export { YTClient } from "./client.js";

export type {
  Video,
  VideoTitle,
  Channel,
  RecentVideo,
  Playlist,
  PlaylistInfo,
  PlaylistVideo,
  ParsedURL,
  Thumbnails,
  Thumbnail,
  YTOptions,
} from "./types.js";

export {
  YTError,
  NotFoundError,
  QuotaError,
  InvalidURLError,
  AuthError,
} from "./errors.js";

export { parseURL, isVideoURL, isPlaylistURL } from "./modules/url.js";

export {
  parseDuration,
  formatDuration,
  formatDurationClock,
} from "./utils/duration.js";

export { formatNumber, formatDate, relativeTime } from "./utils/format.js";

export {
  extractVideoId,
  extractPlaylistId,
  extractChannelId,
  extractUsername,
} from "./utils/url-patterns.js";
