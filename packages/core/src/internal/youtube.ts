import { NotFoundError } from "../errors.js";
import type { HttpClient } from "../http.js";
import type { PlaylistInfo, PlaylistVideo } from "../types.js";
import type { YTThumbnails } from "../types-internal.js";
import {
  extractPlaylistId,
  formatDurationClock,
  formatNumber,
  parseDuration,
} from "../utils/index.js";

export const YOUTUBE_MAX_RESULTS = 50;

interface YTPlaylistResource {
  id: string;
  snippet: {
    title: string;
    description: string;
    thumbnails: YTThumbnails;
  };
}

interface YTPlaylistListResponse {
  items: YTPlaylistResource[];
}

interface YTPlaylistItemResource {
  contentDetails: {
    videoId: string;
  };
}

interface YTPlaylistItemsResponse {
  items: YTPlaylistItemResource[];
  nextPageToken?: string;
}

interface YTPlaylistVideoResource {
  id: string;
  snippet: {
    title: string;
    description: string;
    channelTitle: string;
    publishedAt: string;
    thumbnails: YTThumbnails;
  };
  statistics: {
    viewCount?: string;
    likeCount?: string;
  };
  contentDetails: {
    duration: string;
  };
}

interface YTVideoListResponse {
  items: YTPlaylistVideoResource[];
}

export function chunkArray<T>(arr: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < arr.length; i += size) {
    chunks.push(arr.slice(i, i + size));
  }
  return chunks;
}

export function resolvePlaylistId(urlOrId: string): string {
  return extractPlaylistId(urlOrId) ?? urlOrId;
}

export async function fetchPlaylistInfo(
  http: HttpClient,
  playlistId: string
): Promise<PlaylistInfo> {
  const data = await http.get<YTPlaylistListResponse>("playlists", {
    part: "snippet",
    id: playlistId,
  });

  const item = data.items?.[0];
  if (!item) throw new NotFoundError("Playlist", playlistId);

  return {
    id: item.id,
    title: item.snippet.title,
    description: item.snippet.description,
    thumbnails: item.snippet.thumbnails as YTThumbnails as PlaylistInfo["thumbnails"],
  };
}

export async function fetchPlaylistVideoIds(
  http: HttpClient,
  playlistId: string
): Promise<string[]> {
  const ids: string[] = [];
  let pageToken: string | undefined;

  do {
    const params: Record<string, string> = {
      part: "contentDetails",
      playlistId,
      maxResults: YOUTUBE_MAX_RESULTS.toString(),
    };
    if (pageToken) {
      params.pageToken = pageToken;
    }

    const page = await http.get<YTPlaylistItemsResponse>("playlistItems", params);

    if (!page.items?.length) break;

    for (const item of page.items) {
      ids.push(item.contentDetails.videoId);
    }

    pageToken = page.nextPageToken;
  } while (pageToken);

  return ids;
}

export async function fetchPlaylistVideos(
  http: HttpClient,
  videoIds: string[]
): Promise<PlaylistVideo[]> {
  if (videoIds.length === 0) return [];

  const chunks = chunkArray(videoIds, YOUTUBE_MAX_RESULTS);
  const results = await Promise.all(
    chunks.map((chunk) =>
      http.get<YTVideoListResponse>("videos", {
        part: "snippet,statistics,contentDetails",
        id: chunk.join(","),
      })
    )
  );

  return results.flatMap((response) => (response.items ?? []).map(mapPlaylistVideo));
}

function mapPlaylistVideo(item: YTPlaylistVideoResource): PlaylistVideo {
  const duration = parseDuration(item.contentDetails.duration);
  const views = parseInt(item.statistics.viewCount ?? "0", 10);
  const likes = parseInt(item.statistics.likeCount ?? "0", 10);

  return {
    id: item.id,
    title: item.snippet.title,
    description: item.snippet.description,
    channelTitle: item.snippet.channelTitle,
    publishedAt: new Date(item.snippet.publishedAt),
    duration,
    durationFmt: formatDurationClock(duration),
    views,
    viewsFmt: formatNumber(views),
    likes,
    likesFmt: formatNumber(likes),
    thumbnails: item.snippet.thumbnails as YTThumbnails as PlaylistVideo["thumbnails"],
  };
}
