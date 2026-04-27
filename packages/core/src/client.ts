// ---------------------------------------------------------------------------
// lyra-sdk — YTClient (the main orchestrator)
// ---------------------------------------------------------------------------
//
// This is the single object every consumer interacts with.
// It wires the HTTP layer to each domain module and exposes a flat,
// discoverable API surface.
// ---------------------------------------------------------------------------

import { HttpClient, type HttpClientConfig } from "./http.js";
import { getChannel, getChannelVideos } from "./modules/channel.js";
import {
  flattenComments,
  getChannelComments,
  getCommentReplies,
  getCommentStats,
  getCommentsWithReplies,
  getTopComments,
  getVideoComments,
  searchComments,
} from "./modules/comment.js";
import { CommentQueryBuilder } from "./modules/comment-query.js";
import { getLanguages, getRegions } from "./modules/i18n.js";
import { getPlaylist, getPlaylistInfo, getPlaylistVideoIds } from "./modules/playlist.js";
import { PlaylistQueryBuilder } from "./modules/playlist-query.js";
import { isPlaylistURL, isVideoURL, parseURL } from "./modules/url.js";
import { getVideo, getVideos, getVideoTitle, getVideoTitles } from "./modules/video.js";
import {
  getVideoCategories,
  getVideoCategoriesByRegion,
  getVideoCategory,
} from "./modules/video-category.js";
import type {
  Channel,
  Comment,
  CommentOptions,
  CommentStats,
  CommentTextFormat,
  CommentThread,
  I18nLanguage,
  I18nRegion,
  Playlist,
  PlaylistInfo,
  RecentVideo,
  Video,
  VideoCategory,
  YTOptions,
} from "./types.js";
import { extractChannelId, extractPlaylistId, extractVideoId } from "./utils/url-patterns.js";

/**
 * The main client class.
 *
 * Create via `yt(apiKey)` — don't instantiate directly.
 */
export class YTClient {
  private readonly http: HttpClient;

  constructor(apiKey: string, options: YTOptions = {}) {
    const httpConfig: HttpClientConfig = { apiKey };
    if (options.baseUrl !== undefined) httpConfig.baseUrl = options.baseUrl;
    if (options.maxRetries !== undefined) httpConfig.maxRetries = options.maxRetries;
    this.http = new HttpClient(httpConfig);
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
  // Video Category
  // -----------------------------------------------------------------------

  /** Fetch a single video category by ID. */
  async videoCategory(id: string): Promise<VideoCategory> {
    return getVideoCategory(this.http, id);
  }

  /** Fetch multiple video categories by IDs. */
  async videoCategories(ids: string[]): Promise<VideoCategory[]> {
    return getVideoCategories(this.http, ids);
  }

  /** Fetch all video categories available in a region. */
  async videoCategoriesByRegion(regionCode: string, hl?: string): Promise<VideoCategory[]> {
    return getVideoCategoriesByRegion(this.http, regionCode, hl);
  }

  // -----------------------------------------------------------------------
  // I18n
  // -----------------------------------------------------------------------

  /** Fetch all supported content regions. */
  async regions(hl?: string): Promise<I18nRegion[]> {
    return getRegions(this.http, hl);
  }

  /** Fetch all supported application languages. */
  async languages(hl?: string): Promise<I18nLanguage[]> {
    return getLanguages(this.http, hl);
  }

  // -----------------------------------------------------------------------
  // Comments
  // -----------------------------------------------------------------------

  /** Fetch all comment threads for a video. Auto-paginates. */
  async comments(videoUrlOrId: string, opts?: CommentOptions): Promise<CommentThread[]> {
    return getVideoComments(this.http, videoUrlOrId, opts);
  }

  /** Fetch all replies to a specific comment. Auto-paginates. */
  async commentReplies(commentId: string, textFormat?: CommentTextFormat): Promise<Comment[]> {
    return getCommentReplies(this.http, commentId, textFormat);
  }

  /** Fetch comment threads with all replies auto-fetched. */
  async commentsWithReplies(videoUrlOrId: string, opts?: CommentOptions): Promise<CommentThread[]> {
    return getCommentsWithReplies(this.http, videoUrlOrId, opts);
  }

  /** Fetch top comments sorted by relevance. */
  async topComments(videoUrlOrId: string, limit?: number): Promise<CommentThread[]> {
    return getTopComments(this.http, videoUrlOrId, limit);
  }

  /** Search comments by keyword. */
  async searchComments(videoUrlOrId: string, query: string): Promise<CommentThread[]> {
    return searchComments(this.http, videoUrlOrId, query);
  }

  /** Fetch all comment threads for a channel. */
  async channelComments(channelId: string, opts?: CommentOptions): Promise<CommentThread[]> {
    return getChannelComments(this.http, channelId, opts);
  }

  /** Compute aggregate stats from comment threads. */
  commentStats(videoId: string, threads: CommentThread[]): CommentStats {
    return getCommentStats(videoId, threads);
  }

  /** Flatten threads + replies into a single flat array. */
  flattenComments(threads: CommentThread[]): Comment[] {
    return flattenComments(threads);
  }

  /**
   * Create a comment query builder for filtering, sorting, and slicing.
   *
   * ```ts
   * const result = await client.commentQuery("dQw4w9WgXcQ")
   *   .order("relevance")
   *   .search("love this")
   *   .limit(50)
   *   .withAllReplies()
   *   .execute()
   * ```
   */
  commentQuery(videoUrlOrId: string): CommentQueryBuilder {
    return new CommentQueryBuilder(this.http, videoUrlOrId);
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
