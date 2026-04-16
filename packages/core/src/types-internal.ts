/**
 * Internal types matching YouTube API response shapes.
 * These are NOT exported to consumers — only used internally.
 */

export interface YTThumbnailResource {
  url: string;
  width: number;
  height: number;
}

export interface YTThumbnails {
  default?: YTThumbnailResource;
  medium?: YTThumbnailResource;
  high?: YTThumbnailResource;
  standard?: YTThumbnailResource;
  maxres?: YTThumbnailResource;
}
