// ---------------------------------------------------------------------------
// lyra-sdk — Channel module
// ---------------------------------------------------------------------------

import type { HttpClient } from "../http.js";
import type { Channel, RecentVideo } from "../types.js";
import type { YTThumbnails } from "../types-internal.js";
import { NotFoundError } from "../errors.js";
import {
  parseDuration,
  formatDurationClock,
  formatNumber,
  relativeTime,
  extractChannelId,
  extractUsername,
} from "../utils/index.js";

// ---------------------------------------------------------------------------
// YouTube API response shapes (internal)
// ---------------------------------------------------------------------------

interface YTChannelResource {
  id: string;
  snippet: {
    title: string;
    customUrl?: string;
    country?: string;
    thumbnails: YTThumbnails;
  };
  statistics: {
    subscriberCount?: string;
    viewCount?: string;
    videoCount?: string;
  };
  contentDetails: {
    relatedPlaylists: { uploads: string };
  };
}

interface YTChannelListResponse {
  items: YTChannelResource[];
}

interface YTPlaylistItemResource {
  snippet: {
    title: string;
    publishedAt: string;
    resourceId: { videoId: string };
    thumbnails: YTThumbnails;
  };
}

interface YTVideoStatsResource {
  id: string;
  statistics: { viewCount?: string; likeCount?: string };
  contentDetails: { duration: string };
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Resolve a channel URL, `@username`, bare channel ID, or `/c/custom` URL
 * into a channel ID that YouTube's API can consume.
 */
async function resolveChannelId(
  http: HttpClient,
  input: string,
): Promise<string> {
  if (/^UC[\w-]{22}$/.test(input)) return input;

  const fromUrl = extractChannelId(input);
  if (fromUrl) return fromUrl;

  const username =
    extractUsername(input) ?? (input.startsWith("@") ? input.slice(1) : null);
  if (username) {
    return searchChannelId(http, username);
  }

  const customMatch = input.match(/(?:youtube\.com\/)?(?:c|user)\/([^/\n\s]+)/);
  if (customMatch) {
    return searchChannelId(http, customMatch[1]);
  }

  return input;
}

/**
 * Fetch full channel metadata.
 *
 * Accepts a channel ID, `@username`, or channel URL.
 */
export async function getChannel(
  http: HttpClient,
  urlOrId: string,
): Promise<Channel> {
  const channelId = await resolveChannelId(http, urlOrId);

  const data = await http.get<YTChannelListResponse>("channels", {
    part: "snippet,statistics,contentDetails",
    id: channelId,
  });

  const item = data.items?.[0];
  if (!item) throw new NotFoundError("Channel", channelId);

  const subs = parseInt(item.statistics.subscriberCount ?? "0", 10);
  const views = parseInt(item.statistics.viewCount ?? "0", 10);

  return {
    id: item.id,
    name: item.snippet.title,
    username: item.snippet.customUrl
      ? `@${item.snippet.customUrl}`
      : `@${item.snippet.title.toLowerCase().replace(/\s+/g, "")}`,
    subscribers: subs,
    subscribersFmt: formatNumber(subs),
    totalViews: views,
    totalViewsFmt: formatNumber(views),
    videoCount: parseInt(item.statistics.videoCount ?? "0", 10),
    country: item.snippet.country,
    thumbnails: item.snippet
      .thumbnails as YTThumbnails as Channel["thumbnails"],
    uploadsPlaylistId: item.contentDetails.relatedPlaylists.uploads,
  };
}

/**
 * Fetch a channel's most recent uploads.
 */
export async function getChannelVideos(
  http: HttpClient,
  urlOrId: string,
  options: { limit?: number } = {},
): Promise<RecentVideo[]> {
  const limit = Math.min(options.limit ?? 5, 50);
  const channel = await getChannel(http, urlOrId);

  const playlistData = await http.get<{ items: YTPlaylistItemResource[] }>(
    "playlistItems",
    {
      part: "snippet",
      playlistId: channel.uploadsPlaylistId,
      maxResults: limit.toString(),
    },
  );

  const items = playlistData.items ?? [];
  if (items.length === 0) return [];

  const videoIds = items.map((i) => i.snippet.resourceId.videoId).join(",");
  const videoStats = await http.get<{ items: YTVideoStatsResource[] }>(
    "videos",
    {
      part: "statistics,contentDetails",
      id: videoIds,
    },
  );

  const statsMap = new Map((videoStats.items ?? []).map((v) => [v.id, v]));

  return items.map((item) => {
    const videoId = item.snippet.resourceId.videoId;
    const stats = statsMap.get(videoId);
    const views = parseInt(stats?.statistics.viewCount ?? "0", 10);
    const likes = parseInt(stats?.statistics.likeCount ?? "0", 10);
    const duration = parseDuration(stats?.contentDetails.duration ?? "PT0S");
    const publishedAt = new Date(item.snippet.publishedAt);

    return {
      id: videoId,
      title: item.snippet.title,
      views,
      viewsFmt: formatNumber(views),
      likes,
      likesFmt: formatNumber(likes),
      duration,
      durationFmt: formatDurationClock(duration),
      thumbnail:
        item.snippet.thumbnails?.high?.url ??
        item.snippet.thumbnails?.default?.url ??
        "",
      uploadAge: relativeTime(publishedAt),
      publishedAt,
    };
  });
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

async function searchChannelId(
  http: HttpClient,
  query: string,
): Promise<string> {
  const data = await http.get<{
    items: Array<{ snippet: { channelId: string } }>;
  }>("search", {
    part: "snippet",
    q: query,
    type: "channel",
    maxResults: "1",
  });

  const channelId = data.items?.[0]?.snippet.channelId;
  if (!channelId) throw new NotFoundError("Channel", query);
  return channelId;
}
