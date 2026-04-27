// ---------------------------------------------------------------------------
// lyra-sdk — Video module
// ---------------------------------------------------------------------------

import { NotFoundError } from "../errors.js";
import type { HttpClient } from "../http.js";
import { chunkArray, YOUTUBE_MAX_RESULTS } from "../internal/youtube.js";
import type { Video } from "../types.js";
import type { YTThumbnails } from "../types-internal.js";
import {
  extractVideoId,
  formatDate,
  formatDurationClock,
  formatNumber,
  parseDuration,
} from "../utils/index.js";

// ---------------------------------------------------------------------------
// YouTube API response shapes (internal — not exported)
// ---------------------------------------------------------------------------

interface YTVideoResource {
  id: string;
  snippet: {
    title: string;
    description: string;
    channelId: string;
    channelTitle: string;
    publishedAt: string;
    thumbnails: YTThumbnails;
  };
  statistics: {
    viewCount?: string;
    likeCount?: string;
    commentCount?: string;
  };
  contentDetails: {
    duration: string;
  };
}

interface YTVideoListResponse {
  items: YTVideoResource[];
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Resolve a video URL or bare ID — always returns a string ID.
 */
function resolveId(urlOrId: string): string {
  return extractVideoId(urlOrId) ?? urlOrId;
}

/**
 * Fetch full details for a single video.
 */
export async function getVideo(http: HttpClient, urlOrId: string): Promise<Video> {
  const id = resolveId(urlOrId);

  const data = await http.get<YTVideoListResponse>("videos", {
    part: "snippet,statistics,contentDetails",
    id,
  });

  const item = data.items?.[0];
  if (!item) throw new NotFoundError("Video", id);

  return mapVideo(item);
}

/**
 * Fetch multiple videos in a single logical call.
 *
 * Internally batches into chunks of 50 (YouTube API max per request) and
 * runs them in parallel.
 */
export async function getVideos(http: HttpClient, urlsOrIds: string[]): Promise<Video[]> {
  const ids = urlsOrIds.map(resolveId);
  const chunks = chunkArray(ids, YOUTUBE_MAX_RESULTS);

  const results = await Promise.all(
    chunks.map((chunk) =>
      http.get<YTVideoListResponse>("videos", {
        part: "snippet,statistics,contentDetails",
        id: chunk.join(","),
      })
    )
  );

  const allItems = results.flatMap((r) => r.items ?? []);

  return allItems.map(mapVideo);
}

/**
 * Lightweight title-only lookup. Uses `snippet` part only (1 quota unit).
 */
export async function getVideoTitle(http: HttpClient, urlOrId: string): Promise<string> {
  const id = resolveId(urlOrId);

  const data = await http.get<YTVideoListResponse>("videos", {
    part: "snippet",
    id,
  });

  return data.items?.[0]?.snippet.title ?? `Video ${id}`;
}

/**
 * Batch title lookup → `{ [videoId]: title }`.
 */
export async function getVideoTitles(
  http: HttpClient,
  urlsOrIds: string[]
): Promise<Record<string, string>> {
  const ids = urlsOrIds.map(resolveId);
  const chunks = chunkArray(ids, YOUTUBE_MAX_RESULTS);

  const results = await Promise.all(
    chunks.map((chunk) =>
      http.get<YTVideoListResponse>("videos", {
        part: "snippet",
        id: chunk.join(","),
      })
    )
  );

  const map: Record<string, string> = {};
  for (const r of results) {
    for (const item of r.items ?? []) {
      map[item.id] = item.snippet.title;
    }
  }

  for (const id of ids) {
    map[id] ??= `Video ${id}`;
  }

  return map;
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

function mapVideo(item: YTVideoResource): Video {
  const views = parseInt(item.statistics.viewCount ?? "0", 10);
  const likes = parseInt(item.statistics.likeCount ?? "0", 10);
  const comments = parseInt(item.statistics.commentCount ?? "0", 10);
  const duration = parseDuration(item.contentDetails.duration);

  return {
    id: item.id,
    title: item.snippet.title,
    description: item.snippet.description,
    channel: item.snippet.channelTitle,
    channelId: item.snippet.channelId,
    views,
    viewsFmt: formatNumber(views),
    likes,
    likesFmt: formatNumber(likes),
    comments,
    commentsFmt: formatNumber(comments),
    duration,
    durationFmt: formatDurationClock(duration),
    published: formatDate(item.snippet.publishedAt),
    publishedAt: new Date(item.snippet.publishedAt),
    thumbnails: item.snippet.thumbnails as YTThumbnails as Video["thumbnails"],
  };
}
