import { HttpClient } from "../http.js";
import { extractPlaylistId } from "../utils/url-patterns.js";
import { fetchTranscript } from "./fetch.js";
import { TranscriptPlaylistError } from "./errors.js";
import { resolveVideoId } from "./parse.js";
import type {
  PlaylistTranscriptOptions,
  PlaylistTranscriptResult,
  TranscriptLine,
  TranscriptOptions,
  VideoTranscriptResult,
} from "./types.js";

const PAGE_SIZE = 50;

interface YTPlaylistItemResource {
  contentDetails: { videoId: string };
}

interface YTPlaylistItemsResponse {
  items: YTPlaylistItemResource[];
  nextPageToken?: string;
}

interface YTVideoResource {
  id: string;
  snippet: { title: string };
}

interface YTVideoListResponse {
  items: YTVideoResource[];
}

function resolvePlaylistId(urlOrId: string): string {
  return extractPlaylistId(urlOrId) ?? urlOrId;
}

async function fetchAllVideoIds(http: HttpClient, playlistId: string): Promise<string[]> {
  const ids: string[] = [];
  let pageToken: string | undefined;

  do {
    const params: Record<string, string> = {
      part: "contentDetails",
      playlistId,
      maxResults: PAGE_SIZE.toString(),
    };
    if (pageToken) params.pageToken = pageToken;

    const page = await http.get<YTPlaylistItemsResponse>("playlistItems", params);
    if (!page.items?.length) break;

    for (const item of page.items) {
      ids.push(item.contentDetails.videoId);
    }

    pageToken = page.nextPageToken;
  } while (pageToken);

  return ids;
}

async function fetchVideoTitles(
  http: HttpClient,
  videoIds: string[],
): Promise<Map<string, string>> {
  if (videoIds.length === 0) return new Map();

  const map = new Map<string, string>();
  const chunks: string[][] = [];
  for (let i = 0; i < videoIds.length; i += PAGE_SIZE) {
    chunks.push(videoIds.slice(i, i + PAGE_SIZE));
  }

  const results = await Promise.all(
    chunks.map((chunk) =>
      http.get<YTVideoListResponse>("videos", {
        part: "snippet",
        id: chunk.join(","),
      }),
    ),
  );

  for (const res of results) {
    for (const item of res.items ?? []) {
      map.set(item.id, item.snippet.title);
    }
  }

  return map;
}

async function pool<T, R>(
  items: T[],
  limit: number,
  fn: (item: T, index: number) => Promise<R>,
): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let next = 0;

  async function worker() {
    while (next < items.length) {
      const idx = next++;
      results[idx] = await fn(items[idx], idx);
    }
  }

  const workers = Array.from({ length: Math.min(limit, items.length) }, () => worker());
  await Promise.all(workers);
  return results;
}

function validateRange(from: number | undefined, to: number | undefined): void {
  if (from !== undefined && from < 1) {
    throw new TranscriptPlaylistError(`"from" must be >= 1, got ${from}`);
  }
  if (to !== undefined && to < 1) {
    throw new TranscriptPlaylistError(`"to" must be >= 1, got ${to}`);
  }
  if (from !== undefined && to !== undefined && to < from) {
    throw new TranscriptPlaylistError(`"to" (${to}) must be >= "from" (${from})`);
  }
}

export async function transcribePlaylist(
  playlistUrlOrId: string,
  options: PlaylistTranscriptOptions,
): Promise<PlaylistTranscriptResult> {
  const playlistId = resolvePlaylistId(playlistUrlOrId);
  const { apiKey, from, to, concurrency = 3, onProgress, ...transcriptOpts } = options;

  validateRange(from, to);

  const http = new HttpClient({ apiKey });

  const allIds = await fetchAllVideoIds(http, playlistId);

  if (allIds.length === 0) {
    return {
      playlistId,
      totalVideos: 0,
      requestedRange: [from ?? 1, to ?? 0],
      succeeded: 0,
      failed: 0,
      results: [],
    };
  }

  const startIndex = Math.max((from ?? 1) - 1, 0);
  const endIndex = to !== undefined ? Math.min(to, allIds.length) : allIds.length;

  if (startIndex >= allIds.length) {
    return {
      playlistId,
      totalVideos: allIds.length,
      requestedRange: [from ?? 1, to ?? allIds.length],
      succeeded: 0,
      failed: 0,
      results: [],
    };
  }

  const slicedIds = allIds.slice(startIndex, endIndex);
  const titles = await fetchVideoTitles(http, slicedIds);

  const total = slicedIds.length;
  let done = 0;
  let succeeded = 0;
  let failed = 0;

  const results = await pool(slicedIds, concurrency, async (videoId, idx) => {
    const position = startIndex + idx + 1;
    const title = titles.get(videoId) ?? "";

    try {
      const resolved = resolveVideoId(videoId);
      const lines = (await fetchTranscript(resolved, transcriptOpts as TranscriptOptions)) as TranscriptLine[];
      done++;
      succeeded++;
      onProgress?.(done, total, videoId, "success");
      return { videoId, title, position, status: "success" as const, lines };
    } catch (err) {
      done++;
      failed++;
      const error = err instanceof Error ? err.message : String(err);
      onProgress?.(done, total, videoId, "failed");
      return { videoId, title, position, status: "failed" as const, error };
    }
  });

  return {
    playlistId,
    totalVideos: allIds.length,
    requestedRange: [from ?? 1, to ?? allIds.length],
    succeeded,
    failed,
    results,
  };
}
