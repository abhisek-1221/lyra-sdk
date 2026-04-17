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
import type {
  PlaylistInfo,
  PlaylistQueryResult,
  PlaylistVideo,
  PlaylistVideoFilters,
  SortField,
  SortOrder,
} from "../types.js";
import type { YTThumbnails } from "../types-internal.js";
import {
  formatDuration,
  formatDurationClock,
  formatNumber,
  parseDuration,
} from "../utils/index.js";

// ---------------------------------------------------------------------------
// YouTube API response shapes (internal)
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
    const [info, videoIds] = await Promise.all([this.getPlaylistInfo(), this.getAllVideoIds()]);

    const originalCount = videoIds.length;
    let videos = await this.getVideoDetails(videoIds);

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

  private async getPlaylistInfo(): Promise<PlaylistInfo> {
    const data = await this.http.get<YTPlaylistListResponse>("playlists", {
      part: "snippet",
      id: this.playlistId,
    });

    const item = data.items?.[0];
    if (!item) {
      throw new Error(`Playlist not found: ${this.playlistId}`);
    }

    return {
      id: item.id,
      title: item.snippet.title,
      description: item.snippet.description,
      thumbnails: item.snippet.thumbnails as YTThumbnails as PlaylistInfo["thumbnails"],
    };
  }

  private async getAllVideoIds(): Promise<string[]> {
    const ids: string[] = [];
    let pageToken: string | undefined;

    do {
      const params: Record<string, string> = {
        part: "contentDetails",
        playlistId: this.playlistId,
        maxResults: PAGE_SIZE.toString(),
      };
      if (pageToken) {
        params.pageToken = pageToken;
      }

      const page = await this.http.get<YTPlaylistItemsResponse>("playlistItems", params);

      if (!page.items?.length) break;

      for (const item of page.items) {
        ids.push(item.contentDetails.videoId);
      }

      pageToken = page.nextPageToken;
    } while (pageToken);

    return ids;
  }

  private async getVideoDetails(videoIds: string[]): Promise<PlaylistVideo[]> {
    if (videoIds.length === 0) return [];

    const chunks = this.chunkArray(videoIds, PAGE_SIZE);

    const results = await Promise.all(
      chunks.map((chunk) =>
        this.http.get<YTVideoListResponse>("videos", {
          part: "snippet,statistics,contentDetails",
          id: chunk.join(","),
        })
      )
    );

    return results.flatMap((response) =>
      (response.items ?? []).map((item) => {
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
      })
    );
  }

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

  private chunkArray<T>(arr: T[], size: number): T[][] {
    const chunks: T[][] = [];
    for (let i = 0; i < arr.length; i += size) {
      chunks.push(arr.slice(i, i + size));
    }
    return chunks;
  }
}
