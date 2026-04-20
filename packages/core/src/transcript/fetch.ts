import {
  DEFAULT_USER_AGENT,
  INNERTUBE_CLIENT_NAME,
  INNERTUBE_CLIENT_VERSION,
} from "./constants.js";
import {
  TranscriptDisabledError,
  TranscriptLanguageError,
  TranscriptNotFoundError,
  TranscriptRateLimitError,
  TranscriptVideoUnavailableError,
} from "./errors.js";
import { parseTranscriptXml, resolveVideoId, validateLang } from "./parse.js";
import type {
  CaptionTrack,
  InnertubePlayerResponse,
  InternalCaptionTrack,
  TranscriptLine,
  TranscriptOptions,
  TranscriptWithMeta,
  VideoMeta,
} from "./types.js";

async function doFetch(
  url: string,
  init: RequestInit & { lang?: string; userAgent?: string },
  customFetch?: TranscriptOptions["customFetch"]
): Promise<Response> {
  if (customFetch) return customFetch(url, init);
  return fetch(url, init);
}

async function fetchCaptionTracks(
  videoId: string,
  options?: TranscriptOptions
): Promise<{
  tracks: InternalCaptionTrack[];
  playerJson: InnertubePlayerResponse;
}> {
  const identifier = resolveVideoId(videoId);
  const lang = options?.lang;
  if (lang) validateLang(lang);

  const userAgent = options?.userAgent ?? DEFAULT_USER_AGENT;
  const protocol = options?.useHttp ? "http" : "https";
  const signal = options?.signal;

  const headers: Record<string, string> = { "User-Agent": userAgent };
  if (lang) headers["Accept-Language"] = lang;

  const watchUrl = `${protocol}://www.youtube.com/watch?v=${identifier}`;
  const watchRes = await doFetch(
    watchUrl,
    { method: "GET", headers, signal },
    options?.customFetch
  );

  if (!watchRes.ok) throw new TranscriptVideoUnavailableError(identifier);

  const watchBody = await watchRes.text();

  if (watchBody.includes('class="g-recaptcha"')) {
    throw new TranscriptRateLimitError();
  }

  const apiKeyMatch =
    watchBody.match(/"INNERTUBE_API_KEY":"([^"]+)"/) ||
    watchBody.match(/INNERTUBE_API_KEY\\":\\"([^\\"]+)\\"/);

  if (!apiKeyMatch) throw new TranscriptNotFoundError(identifier);
  const apiKey = apiKeyMatch[1];

  const playerUrl = `${protocol}://www.youtube.com/youtubei/v1/player?key=${apiKey}`;
  const playerBody = JSON.stringify({
    context: {
      client: {
        clientName: INNERTUBE_CLIENT_NAME,
        clientVersion: INNERTUBE_CLIENT_VERSION,
      },
    },
    videoId: identifier,
  });

  const playerRes = await doFetch(
    playerUrl,
    {
      method: "POST",
      headers: { ...headers, "Content-Type": "application/json" },
      body: playerBody,
      signal,
    },
    options?.customFetch
  );

  if (!playerRes.ok) throw new TranscriptVideoUnavailableError(identifier);

  const playerJson = (await playerRes.json()) as InnertubePlayerResponse;

  const tracklist =
    playerJson.captions?.playerCaptionsTracklistRenderer ??
    playerJson.playerCaptionsTracklistRenderer;

  const tracks = tracklist?.captionTracks;
  const isPlayable = playerJson.playabilityStatus?.status === "OK";

  if (!playerJson.captions || !tracklist) {
    throw isPlayable
      ? new TranscriptDisabledError(identifier)
      : new TranscriptNotFoundError(identifier);
  }

  if (!Array.isArray(tracks) || tracks.length === 0) {
    throw new TranscriptDisabledError(identifier);
  }

  return { tracks, playerJson };
}

function extractVideoMeta(playerJson: InnertubePlayerResponse, fallbackId: string): VideoMeta {
  const raw = playerJson.videoDetails;
  return {
    videoId: raw?.videoId ?? fallbackId,
    title: raw?.title ?? "",
    author: raw?.author ?? "",
    channelId: raw?.channelId ?? "",
    lengthSeconds: parseInt(raw?.lengthSeconds ?? "0", 10),
    viewCount: parseInt(raw?.viewCount ?? "0", 10),
    description: raw?.shortDescription ?? "",
    keywords: raw?.keywords ?? [],
    thumbnails: raw?.thumbnail?.thumbnails ?? [],
    isLiveContent: raw?.isLiveContent ?? false,
  };
}

export async function fetchTranscript(
  videoId: string,
  options?: TranscriptOptions
): Promise<TranscriptLine[] | TranscriptWithMeta> {
  const identifier = resolveVideoId(videoId);
  const lang = options?.lang;
  if (lang) validateLang(lang);

  const { tracks, playerJson } = await fetchCaptionTracks(identifier, options);

  const selected = lang ? tracks.find((t) => t.languageCode === lang) : tracks[0];

  if (!selected) {
    const available = tracks.map((t) => t.languageCode).filter(Boolean);
    throw new TranscriptLanguageError(lang!, available, identifier);
  }

  let transcriptUrl = selected.baseUrl ?? selected.url;
  if (!transcriptUrl) throw new TranscriptNotFoundError(identifier);

  transcriptUrl = transcriptUrl.replace(/&fmt=[^&]+/, "");
  if (options?.useHttp) {
    transcriptUrl = transcriptUrl.replace(/^https:\/\//, "http://");
  }

  const userAgent = options?.userAgent ?? DEFAULT_USER_AGENT;
  const headers: Record<string, string> = { "User-Agent": userAgent };
  if (lang) headers["Accept-Language"] = lang;

  const transcriptRes = await doFetch(
    transcriptUrl,
    { method: "GET", headers, signal: options?.signal },
    options?.customFetch
  );

  if (!transcriptRes.ok) {
    throw transcriptRes.status === 429
      ? new TranscriptRateLimitError()
      : new TranscriptNotFoundError(identifier);
  }

  const transcriptXml = await transcriptRes.text();
  const lines = parseTranscriptXml(transcriptXml, lang ?? selected.languageCode);

  if (lines.length === 0) throw new TranscriptNotFoundError(identifier);

  if (options?.includeMeta) {
    return {
      meta: extractVideoMeta(playerJson, identifier),
      lines,
    };
  }

  return lines;
}

export async function fetchCaptionList(
  videoId: string,
  options?: TranscriptOptions
): Promise<CaptionTrack[]> {
  const identifier = resolveVideoId(videoId);
  const { tracks } = await fetchCaptionTracks(identifier, options);

  return tracks.map((t) => ({
    languageCode: t.languageCode,
    languageName: t.name?.simpleText ?? t.languageCode,
    isAutoGenerated: t.kind === "asr",
  }));
}
