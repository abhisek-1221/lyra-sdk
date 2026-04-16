// ---------------------------------------------------------------------------
// lyra-sdk — Playlist module (primary feature)
// ---------------------------------------------------------------------------
//
// This is the heart of the package. It handles:
//   • Playlist metadata fetching
//   • Auto-paginated video ID collection (handles >50 video playlists)
//   • Batch video detail enrichment (stats + duration) in parallel chunks
//   • Aggregated playlist-level statistics (total duration, video count)
//
// Every public function accepts either a playlist URL or a bare playlist ID.
// ---------------------------------------------------------------------------

import { NotFoundError } from "../errors.js";
import type { HttpClient } from "../http.js";
import type { Playlist, PlaylistInfo, PlaylistVideo } from "../types.js";
import type { YTThumbnails } from "../types-internal.js";
import {
  extractPlaylistId,
  formatDuration,
  formatDurationClock,
  formatNumber,
  parseDuration,
} from "../utils/index.js";

// ---------------------------------------------------------------------------
// YouTube API response shapes (internal — never exposed to consumers)
// ---------------------------------------------------------------------------

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

interface YTVideoResource {
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
  items: YTVideoResource[];
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const PAGE_SIZE = 50;

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Resolve a playlist URL or bare ID into a usable playlist ID.
 *
 * Accepts:
 *   - Full URL: `https://www.youtube.com/playlist?list=PLxxx`
 *   - Watch URL with list: `https://www.youtube.com/watch?v=xxx&list=PLxxx`
 *   - Bare ID: `PLrAXtmErZgOeiKm4sgNOknGvNjby9efdf`
 */
function resolvePlaylistId(urlOrId: string): string {
  return extractPlaylistId(urlOrId) ?? urlOrId;
}

/**
 * Fetch playlist metadata only (title, description, thumbnails).
 *
 * Costs 1 quota unit. Use when you only need the playlist's info card.
 */
export async function getPlaylistInfo(http: HttpClient, urlOrId: string): Promise<PlaylistInfo> {
  const id = resolvePlaylistId(urlOrId);

  const data = await http.get<YTPlaylistListResponse>("playlists", {
    part: "snippet",
    id,
  });

  const item = data.items?.[0];
  if (!item) throw new NotFoundError("Playlist", id);

  return {
    id: item.id,
    title: item.snippet.title,
    description: item.snippet.description,
    thumbnails: item.snippet.thumbnails as YTThumbnails as PlaylistInfo["thumbnails"],
  };
}

/**
 * Fetch a complete playlist — metadata + **all** videos with full details.
 *
 * This is the main entry point most consumers will use. It:
 *   1. Fetches playlist metadata via `playlists.list`
 *   2. Auto-paginates through `playlistItems.list` to collect every video ID
 *   3. Batch-fetches video details (snippet + statistics + contentDetails)
 *      in parallel chunks of 50
 *   4. Computes aggregate stats (total duration, video count)
 *
 * ```ts
 * const pl = await client.playlist("https://youtube.com/playlist?list=PLxxx")
 * console.log(pl.totalDurationFmt)  // "2d 5h 32m"
 * console.log(pl.videoCount)        // 142
 * ```
 */
export async function getPlaylist(http: HttpClient, urlOrId: string): Promise<Playlist> {
  const id = resolvePlaylistId(urlOrId);

  const [info, videoIds] = await Promise.all([
    getPlaylistInfo(http, urlOrId),
    getAllVideoIds(http, id),
  ]);

  const { videos, totalDuration } = await getVideoDetails(http, videoIds);

  return {
    ...info,
    videoCount: videos.length,
    totalDuration,
    totalDurationFmt: formatDuration(totalDuration),
    videos,
  };
}

/**
 * Fetch only the video IDs in a playlist. Auto-paginates.
 *
 * Useful when you want to process IDs yourself (e.g. pass them to
 * a transcription pipeline).
 */
export async function getPlaylistVideoIds(http: HttpClient, urlOrId: string): Promise<string[]> {
  const id = resolvePlaylistId(urlOrId);
  return getAllVideoIds(http, id);
}

// ---------------------------------------------------------------------------
// Core internals
// ---------------------------------------------------------------------------

/**
 * Paginate through `playlistItems.list` and collect every video ID.
 *
 * YouTube limits each page to 50 items and provides a `nextPageToken`.
 * We loop until there are no more pages.
 */
async function getAllVideoIds(http: HttpClient, playlistId: string): Promise<string[]> {
  const ids: string[] = [];
  let pageToken: string | undefined;

  do {
    const params: Record<string, string> = {
      part: "contentDetails",
      playlistId,
      maxResults: PAGE_SIZE.toString(),
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

/**
 * Fetch full video details (snippet + stats + duration) in parallel chunks.
 *
 * YouTube's `videos.list` accepts up to 50 IDs per request. For playlists
 * with hundreds of videos we split into chunks and fire them concurrently.
 *
 * Returns the enriched video list and the aggregate total duration.
 */
async function getVideoDetails(
  http: HttpClient,
  videoIds: string[]
): Promise<{ videos: PlaylistVideo[]; totalDuration: number }> {
  if (videoIds.length === 0) {
    return { videos: [], totalDuration: 0 };
  }

  const chunks = chunkArray(videoIds, PAGE_SIZE);

  const results = await Promise.all(
    chunks.map((chunk) =>
      http.get<YTVideoListResponse>("videos", {
        part: "snippet,statistics,contentDetails",
        id: chunk.join(","),
      })
    )
  );

  let totalDuration = 0;

  const videos: PlaylistVideo[] = results.flatMap((response) =>
    (response.items ?? []).map((item) => {
      const duration = parseDuration(item.contentDetails.duration);
      totalDuration += duration;

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
    })
  );

  return { videos, totalDuration };
}

// ---------------------------------------------------------------------------
// Utility
// ---------------------------------------------------------------------------

function chunkArray<T>(arr: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < arr.length; i += size) {
    chunks.push(arr.slice(i, i + size));
  }
  return chunks;
}
