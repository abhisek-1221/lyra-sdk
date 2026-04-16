// ---------------------------------------------------------------------------
// lyra-sdk — URL parsing & validation module (zero API calls)
// ---------------------------------------------------------------------------

import type { ParsedURL } from "../types.js";
import {
  extractVideoId,
  extractPlaylistId,
  extractChannelId,
} from "../utils/url-patterns.js";

const YOUTUBE_HOSTS = new Set([
  "youtube.com",
  "www.youtube.com",
  "m.youtube.com",
  "youtu.be",
]);

/**
 * Parse any YouTube URL into a structured result.
 *
 * This is a **pure function** — no network, no API key needed.
 *
 * ```ts
 * parseURL("https://youtu.be/dQw4w9WgXcQ")
 * // → { isValid: true, type: "video", videoId: "dQw4w9WgXcQ" }
 * ```
 */
export function parseURL(input: string): ParsedURL {
  const trimmed = input?.trim();
  if (!trimmed) {
    return invalid("Please enter a URL");
  }

  let url: URL;
  try {
    url = new URL(trimmed);
  } catch {
    return invalid("Invalid URL format");
  }

  if (!isYouTubeHost(url.hostname)) {
    return invalid("URL must be from YouTube (youtube.com or youtu.be)");
  }

  const videoId = extractVideoId(trimmed);
  const playlistId = extractPlaylistId(trimmed);
  const channelId = extractChannelId(trimmed);

  if (videoId) {
    return {
      isValid: true,
      type: "video",
      videoId,
      playlistId: playlistId ?? undefined,
    };
  }
  if (playlistId) {
    return { isValid: true, type: "playlist", playlistId };
  }
  if (channelId) {
    return { isValid: true, type: "channel", channelId };
  }

  return invalid("Could not extract video, playlist, or channel ID from URL");
}

/**
 * Returns `true` when the URL points to a single video.
 */
export function isVideoURL(input: string): boolean {
  return parseURL(input).type === "video";
}

/**
 * Returns `true` when the URL points to a playlist.
 */
export function isPlaylistURL(input: string): boolean {
  const parsed = parseURL(input);
  return parsed.type === "playlist";
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function isYouTubeHost(hostname: string): boolean {
  return YOUTUBE_HOSTS.has(hostname);
}

function invalid(error: string): ParsedURL {
  return { isValid: false, type: "invalid", error };
}
