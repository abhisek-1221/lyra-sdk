export type YouTubeInput =
  | { readonly url: string }
  | { readonly videoId: string };

export function normalizeYouTubeInput(input: YouTubeInput): YouTubeInput {
  if ("url" in input) return { url: input.url.trim() };
  return { videoId: input.videoId.trim() };
}

