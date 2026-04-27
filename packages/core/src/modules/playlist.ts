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

import type { HttpClient } from "../http.js";
import {
  fetchPlaylistInfo,
  fetchPlaylistVideoIds,
  fetchPlaylistVideos,
  resolvePlaylistId,
} from "../internal/youtube.js";
import type { Playlist, PlaylistInfo, PlaylistVideo } from "../types.js";
import { formatDuration } from "../utils/index.js";

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Fetch playlist metadata only (title, description, thumbnails).
 *
 * Costs 1 quota unit. Use when you only need the playlist's info card.
 */
export async function getPlaylistInfo(http: HttpClient, urlOrId: string): Promise<PlaylistInfo> {
  const id = resolvePlaylistId(urlOrId);
  return fetchPlaylistInfo(http, id);
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
    fetchPlaylistInfo(http, id),
    fetchPlaylistVideoIds(http, id),
  ]);

  const videos = await fetchPlaylistVideos(http, videoIds);
  const totalDuration = totalDurationOf(videos);

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
  return fetchPlaylistVideoIds(http, id);
}

function totalDurationOf(videos: PlaylistVideo[]): number {
  return videos.reduce((sum, video) => sum + video.duration, 0);
}
