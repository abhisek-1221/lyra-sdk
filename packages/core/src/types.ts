// ---------------------------------------------------------------------------
// lyra-sdk — Public type definitions
// ---------------------------------------------------------------------------

/** Thumbnail map returned by YouTube API. */
export interface Thumbnails {
  default: Thumbnail;
  medium: Thumbnail;
  high: Thumbnail;
  standard?: Thumbnail;
  maxres?: Thumbnail;
}

export interface Thumbnail {
  url: string;
  width: number;
  height: number;
}

// ---------------------------------------------------------------------------
// Video
// ---------------------------------------------------------------------------

export interface Video {
  id: string;
  title: string;
  description: string;
  channel: string;
  channelId: string;
  views: number;
  viewsFmt: string;
  likes: number;
  likesFmt: string;
  comments: number;
  commentsFmt: string;
  duration: number;
  durationFmt: string;
  published: string;
  publishedAt: Date;
  thumbnails: Thumbnails;
}

/** Lightweight video — only the title. Costs 1 quota unit. */
export interface VideoTitle {
  id: string;
  title: string;
}

// ---------------------------------------------------------------------------
// Channel
// ---------------------------------------------------------------------------

export interface Channel {
  id: string;
  name: string;
  username: string;
  subscribers: number;
  subscribersFmt: string;
  totalViews: number;
  totalViewsFmt: string;
  videoCount: number;
  country?: string;
  thumbnails: Thumbnails;
  uploadsPlaylistId: string;
}

export interface RecentVideo {
  id: string;
  title: string;
  views: number;
  viewsFmt: string;
  likes: number;
  likesFmt: string;
  duration: number;
  durationFmt: string;
  thumbnail: string;
  uploadAge: string;
  publishedAt: Date;
}

// ---------------------------------------------------------------------------
// Playlist
// ---------------------------------------------------------------------------

export interface PlaylistInfo {
  id: string;
  title: string;
  description: string;
  thumbnails: Thumbnails;
}

export interface PlaylistVideo {
  id: string;
  title: string;
  description: string;
  channelTitle: string;
  publishedAt: Date;
  duration: number;
  durationFmt: string;
  views: number;
  viewsFmt: string;
  likes: number;
  likesFmt: string;
  thumbnails: Thumbnails;
}

export interface Playlist {
  id: string;
  title: string;
  description: string;
  thumbnails: Thumbnails;
  videoCount: number;
  totalDuration: number;
  totalDurationFmt: string;
  videos: PlaylistVideo[];
}

// ---------------------------------------------------------------------------
// Playlist Query
// ---------------------------------------------------------------------------

export type SortField = "duration" | "views" | "likes";
export type SortOrder = "asc" | "desc";

export interface PlaylistSortOptions {
  field: SortField;
  order: SortOrder;
}

export interface PlaylistVideoFilters {
  duration?: { min?: number; max?: number };
  views?: { min?: number; max?: number };
  likes?: { min?: number; max?: number };
}

export interface PlaylistQueryResult {
  id: string;
  title: string;
  description: string;
  thumbnails: Thumbnails;
  videos: PlaylistVideo[];
  videoCount: number;
  originalCount: number;
  totalDuration: number;
  totalDurationFmt: string;
}

// ---------------------------------------------------------------------------
// URL parsing
// ---------------------------------------------------------------------------

export interface ParsedURL {
  isValid: boolean;
  type: "video" | "playlist" | "channel" | "invalid";
  videoId?: string;
  playlistId?: string;
  channelId?: string;
  error?: string;
}

// ---------------------------------------------------------------------------
// Client options
// ---------------------------------------------------------------------------

export interface YTOptions {
  /** Base URL override — useful for testing with a mock server. */
  baseUrl?: string;
  /** Max retries on transient / 5xx errors. Default: 2. */
  maxRetries?: number;
}
