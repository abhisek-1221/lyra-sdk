export type YouTubeInput =
  | { readonly url: string }
  | { readonly videoId: string };

/** Hosts treated as YouTube video URLs for ingest detection. */
const YOUTUBE_HOSTS = new Set([
  "youtube.com",
  "www.youtube.com",
  "m.youtube.com",
  "music.youtube.com",
  "youtu.be",
  "www.youtu.be",
  "youtube-nocookie.com",
  "www.youtube-nocookie.com",
]);

export function normalizeYouTubeInput(input: YouTubeInput): YouTubeInput {
  if ("url" in input) return { url: input.url.trim() };
  return { videoId: input.videoId.trim() };
}

/**
 * True when `value` is a non-empty string whose host is a known
 * YouTube host. Arbitrary strings (queries, document ids, etc.)
 * return false so the pipeline does not treat them as URLs.
 */
export function isYouTubeUrlString(value: unknown): value is string {
  if (typeof value !== "string") return false;
  const trimmed = value.trim();
  if (trimmed.length === 0) return false;
  try {
    const url = new URL(trimmed.includes("://") ? trimmed : `https://${trimmed}`);
    const host = url.hostname.toLowerCase();
    return YOUTUBE_HOSTS.has(host);
  } catch {
    return false;
  }
}

/**
 * True when `value` is a YouTube URL string or a `{ url }` /
 * `{ videoId }` object suitable for `YouTubeTranscriptLoader`.
 */
export function isYouTubeInput(value: unknown): value is YouTubeInput | string {
  if (isYouTubeUrlString(value)) return true;
  if (value === null || typeof value !== "object") return false;
  const obj = value as Record<string, unknown>;
  if ("url" in obj && typeof obj["url"] === "string" && obj["url"].trim().length > 0) {
    return !("videoId" in obj);
  }
  if ("videoId" in obj && typeof obj["videoId"] === "string" && obj["videoId"].trim().length > 0) {
    return !("url" in obj);
  }
  return false;
}

/**
 * Coerce a detected YouTube ingest value to `YouTubeInput`.
 * Call only after `isYouTubeInput` returns true.
 */
export function toYouTubeInput(value: YouTubeInput | string): YouTubeInput {
  if (typeof value === "string") return { url: value.trim() };
  return normalizeYouTubeInput(value);
}

