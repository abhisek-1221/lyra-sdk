// ---------------------------------------------------------------------------
// lyra-sdk — YTClient (the main orchestrator)
// ---------------------------------------------------------------------------
//
// This is the single object every consumer interacts with.
// It wires the HTTP layer to each domain module and exposes a flat,
// discoverable API surface.
// ---------------------------------------------------------------------------

import { HttpClient } from "./http.js";
import { getChannel, getChannelVideos } from "./modules/channel.js";
import { getPlaylist, getPlaylistInfo, getPlaylistVideoIds } from "./modules/playlist.js";
import { PlaylistQueryBuilder } from "./modules/playlist-query.js";
import { isPlaylistURL, isVideoURL, parseURL } from "./modules/url.js";
import { getVideo, getVideos, getVideoTitle, getVideoTitles } from "./modules/video.js";
import type { Channel, Playlist, PlaylistInfo, RecentVideo, Video, YTOptions } from "./types.js";
import { extractChannelId, extractPlaylistId, extractVideoId } from "./utils/url-patterns.js";

/**
 * The main client class.
 *
 * Create via `yt(apiKey)` — don't instantiate directly.
 */
export class YTClient {
  private readonly http: HttpClient;

  constructor(apiKey: string, options: YTOptions = {}) {
    this.http = new HttpClient({
      apiKey,
      baseUrl: options.baseUrl,
      maxRetries: options.maxRetries,
    });
  }

  // -----------------------------------------------------------------------
  // Video
  // -----------------------------------------------------------------------

  /** Fetch full details for a single video (URL or ID). */
  async video(urlOrId: string): Promise<Video> {
    return getVideo(this.http, urlOrId);
  }

  /** Fetch full details for multiple videos. Batched in chunks of 50. */
  async videos(urlsOrIds: string[]): Promise<Video[]> {
    return getVideos(this.http, urlsOrIds);
  }

  /** Lightweight title-only lookup — 1 quota unit. */
  async videoTitle(urlOrId: string): Promise<string> {
    return getVideoTitle(this.http, urlOrId);
  }

  /** Batch title lookup → `{ [videoId]: title }`. */
  async videoTitles(urlsOrIds: string[]): Promise<Record<string, string>> {
    return getVideoTitles(this.http, urlsOrIds);
  }

  // -----------------------------------------------------------------------
  // Channel
  // -----------------------------------------------------------------------

  /** Fetch channel metadata. Accepts channel ID, @username, or URL. */
  async channel(urlOrId: string): Promise<Channel> {
    return getChannel(this.http, urlOrId);
  }

  /** Fetch recent uploads for a channel. */
  async channelVideos(urlOrId: string, options?: { limit?: number }): Promise<RecentVideo[]> {
    return getChannelVideos(this.http, urlOrId, options);
  }

  // -----------------------------------------------------------------------
  // Playlist
  // -----------------------------------------------------------------------

  /**
   * Fetch a complete playlist — metadata + all videos with stats.
   *
   * Auto-paginates past YouTube's 50-item page limit.
   * Returns total duration, video count, and enriched video details.
   */
  async playlist(urlOrId: string): Promise<Playlist> {
    return getPlaylist(this.http, urlOrId);
  }

  /** Fetch playlist metadata only (no videos). 1 quota unit. */
  async playlistInfo(urlOrId: string): Promise<PlaylistInfo> {
    return getPlaylistInfo(this.http, urlOrId);
  }

  /** Fetch all video IDs in a playlist. Auto-paginates. */
  async playlistVideoIds(urlOrId: string): Promise<string[]> {
    return getPlaylistVideoIds(this.http, urlOrId);
  }

  /**
   * Create a playlist query builder for filtering, sorting, and slicing.
   *
   * ```ts
   * const result = await client.playlistQuery("PLxxx")
   *   .filterByViews({ min: 10_000 })
   *   .sortBy("views", "desc")
   *   .between(1, 10)
   *   .execute();
   * ```
   */
  playlistQuery(urlOrId: string): PlaylistQueryBuilder {
    const id = extractPlaylistId(urlOrId) ?? urlOrId;
    return new PlaylistQueryBuilder(this.http, id);
  }

  // -----------------------------------------------------------------------
  // URL utilities (zero API calls, no network needed)
  // -----------------------------------------------------------------------

  readonly url = {
    /** Parse any YouTube URL into a structured result. */
    parse: parseURL,
    /** Check if a URL points to a video. */
    isVideo: isVideoURL,
    /** Check if a URL points to a playlist. */
    isPlaylist: isPlaylistURL,
    /** Extract video ID from URL. Returns null if not found. */
    extractVideoId,
    /** Extract playlist ID from URL. Returns null if not found. */
    extractPlaylistId,
    /** Extract channel ID from URL. Returns null if not found. */
    extractChannelId,
  } as const;
}
