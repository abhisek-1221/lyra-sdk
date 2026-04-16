// ---------------------------------------------------------------------------
// lyra-sdk — URL pattern matching (zero network, zero API key)
// ---------------------------------------------------------------------------

/**
 * Extract a video ID from any recognised YouTube URL format.
 *
 * Supports:
 *   - youtube.com/watch?v=ID
 *   - youtu.be/ID
 *   - youtube.com/embed/ID
 *   - youtube.com/v/ID
 *   - youtube.com/shorts/ID
 *
 * Returns `null` when no video ID can be found.
 */
export function extractVideoId(url: string): string | null {
  const match = url.match(
    /(?:v=|\/(?:embed|shorts|v)\/|youtu\.be\/|\/e\/|watch\?v=|\/watch\?.+&v=)([^&?/\n\s]+)/
  );
  return match?.[1] ?? null;
}

/**
 * Extract a playlist ID from a URL's `list` query parameter.
 */
export function extractPlaylistId(url: string): string | null {
  const match = url.match(/[?&]list=([a-zA-Z0-9_-]+)/);
  return match?.[1] ?? null;
}

/**
 * Extract a channel ID from a `/channel/UCxxx` URL.
 *
 * Note: `@username` and `/c/custom` URLs require an API call to resolve —
 * those are handled by the channel module, not here.
 */
export function extractChannelId(url: string): string | null {
  const match = url.match(/(?:https?:\/\/)?(?:www\.)?youtube\.com\/channel\/([^/\n\s]+)/);
  return match?.[1] ?? null;
}

/**
 * Extract an `@username` handle from a YouTube URL.
 */
export function extractUsername(url: string): string | null {
  const match = url.match(/(?:https?:\/\/)?(?:www\.)?youtube\.com\/@([^/\n\s]+)/);
  return match?.[1] ?? null;
}
