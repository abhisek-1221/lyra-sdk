// ---------------------------------------------------------------------------
// lyra-sdk — Playlist Query Builder
// ---------------------------------------------------------------------------
//
// A fluent API for filtering, sorting, and slicing playlist videos.
//
// Example usage:
//   const result = await client.playlistQuery("PLxxx")
//     .filterByDuration({ min: 120 })
//     .filterByViews({ min: 10_000 })
//     .sortBy("views", "desc")
//     .between(1, 10)
//     .execute();
// ---------------------------------------------------------------------------

import type { HttpClient } from "../http.js";
import {
  fetchPlaylistInfo,
  fetchPlaylistVideoIds,
  fetchPlaylistVideos,
} from "../internal/youtube.js";
import type {
  PlaylistQueryResult,
  PlaylistVideo,
  PlaylistVideoFilters,
  SortField,
  SortOrder,
} from "../types.js";
import { formatDuration } from "../utils/index.js";

// ---------------------------------------------------------------------------
// PlaylistQueryBuilder
// ---------------------------------------------------------------------------

export class PlaylistQueryBuilder {
  private readonly http: HttpClient;
  private readonly playlistId: string;
  private filters?: PlaylistVideoFilters;
  private sortField?: SortField;
  private sortOrder?: SortOrder;
  private rangeStart?: number;
  private rangeEnd?: number;

  constructor(http: HttpClient, playlistId: string) {
    this.http = http;
    this.playlistId = playlistId;
  }

  /**
   * Filter videos by duration range (in seconds).
   */
  filterByDuration(opts: { min?: number; max?: number }): this {
    this.filters ??= {};
    this.filters.duration = {
      min: opts.min,
      max: opts.max,
    };
    return this;
  }

  /**
   * Filter videos by view count range.
   */
  filterByViews(opts: { min?: number; max?: number }): this {
    this.filters ??= {};
    this.filters.views = {
      min: opts.min,
      max: opts.max,
    };
    return this;
  }

  /**
   * Filter videos by like count range.
   */
  filterByLikes(opts: { min?: number; max?: number }): this {
    this.filters ??= {};
    this.filters.likes = {
      min: opts.min,
      max: opts.max,
    };
    return this;
  }

  /**
   * Sort videos by a field.
   *
   * @param field - "duration" | "views" | "likes"
   * @param order - "asc" (low→high) | "desc" (high→low)
   */
  sortBy(field: SortField, order: SortOrder): this {
    this.sortField = field;
    this.sortOrder = order;
    return this;
  }

  /**
   * Return videos in a range (1-indexed).
   *
   * @param start - Start position (1-indexed, inclusive)
   * @param end - End position (1-indexed, inclusive)
   */
  between(start: number, end: number): this {
    this.rangeStart = start;
    this.rangeEnd = end;
    return this;
  }

  /**
   * Execute the query and return the result.
   */
  async execute(): Promise<PlaylistQueryResult> {
    const [info, videoIds] = await Promise.all([
      fetchPlaylistInfo(this.http, this.playlistId),
      fetchPlaylistVideoIds(this.http, this.playlistId),
    ]);

    const originalCount = videoIds.length;
    let videos = await fetchPlaylistVideos(this.http, videoIds);

    videos = this.applyFilters(videos);
    videos = this.applySort(videos);
    videos = this.applyRange(videos);

    const totalDuration = videos.reduce((sum, v) => sum + v.duration, 0);

    return {
      id: info.id,
      title: info.title,
      description: info.description,
      thumbnails: info.thumbnails,
      videos,
      videoCount: videos.length,
      originalCount,
      totalDuration,
      totalDurationFmt: formatDuration(totalDuration),
    };
  }

  // ---------------------------------------------------------------------------
  // Private helpers
  // ---------------------------------------------------------------------------

  private applyFilters(videos: PlaylistVideo[]): PlaylistVideo[] {
    if (!this.filters) return videos;

    return videos.filter((video) => {
      if (this.filters?.duration) {
        const { min, max } = this.filters.duration;
        if (min !== undefined && video.duration < min) return false;
        if (max !== undefined && video.duration > max) return false;
      }

      if (this.filters?.views) {
        const { min, max } = this.filters.views;
        if (min !== undefined && video.views < min) return false;
        if (max !== undefined && video.views > max) return false;
      }

      if (this.filters?.likes) {
        const { min, max } = this.filters.likes;
        if (min !== undefined && video.likes < min) return false;
        if (max !== undefined && video.likes > max) return false;
      }

      return true;
    });
  }

  private applySort(videos: PlaylistVideo[]): PlaylistVideo[] {
    if (!this.sortField || !this.sortOrder) return videos;

    const field = this.sortField;
    const order = this.sortOrder === "asc" ? 1 : -1;

    return [...videos].sort((a, b) => {
      const aVal = a[field];
      const bVal = b[field];
      if (aVal < bVal) return -1 * order;
      if (aVal > bVal) return 1 * order;
      return 0;
    });
  }

  private applyRange(videos: PlaylistVideo[]): PlaylistVideo[] {
    if (this.rangeStart === undefined || this.rangeEnd === undefined) {
      return videos;
    }

    const start = Math.max(1, this.rangeStart);
    const end = Math.min(videos.length, this.rangeEnd);

    if (start > end) return [];
    if (start > videos.length) return [];

    return videos.slice(start - 1, end);
  }
}
