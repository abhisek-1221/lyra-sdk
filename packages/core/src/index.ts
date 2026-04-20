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
    throw new Error("lyra-sdk: API key is required. Get one at https://console.cloud.google.com");
  }
  return new YTClient(apiKey, options);
}

export { YTClient } from "./client.js";
export {
  AuthError,
  InvalidURLError,
  NotFoundError,
  QuotaError,
  YTError,
} from "./errors.js";
export { PlaylistQueryBuilder } from "./modules/playlist-query.js";
export type {
  CacheStore,
  CaptionTrack,
  TranscriptLine,
  TranscriptOptions,
  TranscriptWithMeta,
  VideoMeta,
} from "./modules/transcript.js";
export {
  FsCache,
  InMemoryCache,
  listCaptionTracks,
  TranscriptClient,
  TranscriptDisabledError,
  TranscriptError,
  TranscriptInvalidLangError,
  TranscriptInvalidVideoIdError,
  TranscriptLanguageError,
  TranscriptNotFoundError,
  TranscriptRateLimitError,
  TranscriptVideoUnavailableError,
  toPlainText,
  toSRT,
  toVTT,
  transcribeVideo,
} from "./modules/transcript.js";
export { isPlaylistURL, isVideoURL, parseURL } from "./modules/url.js";
export type {
  Channel,
  ParsedURL,
  Playlist,
  PlaylistInfo,
  PlaylistQueryResult,
  PlaylistVideo,
  PlaylistVideoFilters,
  RecentVideo,
  SortField,
  SortOrder,
  Thumbnail,
  Thumbnails,
  Video,
  VideoTitle,
  YTOptions,
} from "./types.js";
export {
  formatDuration,
  formatDurationClock,
  parseDuration,
} from "./utils/duration.js";
export { formatDate, formatNumber, relativeTime } from "./utils/format.js";
export {
  extractChannelId,
  extractPlaylistId,
  extractUsername,
  extractVideoId,
} from "./utils/url-patterns.js";
