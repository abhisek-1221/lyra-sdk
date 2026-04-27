// ---------------------------------------------------------------------------
// lyra-sdk — Low-level HTTP transport
// ---------------------------------------------------------------------------
// Thin wrapper around `fetch` that handles:
//   1. API key injection
//   2. Error mapping (404 → NotFoundError, 403 → QuotaError, etc.)
//   3. Retries with exponential back-off on transient failures
// ---------------------------------------------------------------------------

import { AuthError, NotFoundError, QuotaError, YTError } from "./errors.js";

const BASE_URL = "https://www.googleapis.com/youtube/v3";

export interface HttpClientConfig {
  apiKey: string;
  baseUrl?: string;
  maxRetries?: number;
}

/**
 * Generic JSON response fetcher scoped to the YouTube Data API.
 *
 * Every module calls `http.get(path, params)` and receives parsed JSON.
 * Network/API concerns are fully contained here.
 */
export class HttpClient {
  private readonly apiKey: string;
  private readonly baseUrl: string;
  private readonly maxRetries: number;

  constructor(config: HttpClientConfig) {
    this.apiKey = config.apiKey;
    this.baseUrl = config.baseUrl ?? BASE_URL;
    this.maxRetries = config.maxRetries ?? 2;
  }

  /**
   * Execute a GET request against the YouTube Data API.
   *
   * @param path  - API path *without* leading slash, e.g. `"videos"`
   * @param params - Query parameters (the `key` param is injected automatically)
   */
  async get<T>(path: string, params: Record<string, string> = {}): Promise<T> {
    const url = this.buildUrl(path, params);
    let lastError: Error | undefined;

    for (let attempt = 0; attempt <= this.maxRetries; attempt++) {
      try {
        const res = await fetch(url.toString());

        if (res.ok) {
          return (await res.json()) as T;
        }

        const body = await this.safeBody(res);
        if (this.isRetryableStatus(res.status) && attempt < this.maxRetries) {
          lastError = new YTError(`YouTube API error (${res.status}): ${body}`, res.status);
          await this.sleep(2 ** attempt * 300);
          continue;
        }

        this.throwForStatus(res.status, body, path, params);
      } catch (err) {
        if (err instanceof YTError) throw err;

        lastError = err as Error;

        if (attempt < this.maxRetries) {
          await this.sleep(2 ** attempt * 300);
        }
      }
    }

    throw new YTError(lastError?.message ?? "Request failed after retries");
  }

  // ---------------------------------------------------------------------------
  // Private helpers
  // ---------------------------------------------------------------------------

  private buildUrl(path: string, params: Record<string, string>): URL {
    const url = new URL(`${this.baseUrl}/${path}`);
    url.searchParams.set("key", this.apiKey);
    for (const [k, v] of Object.entries(params)) {
      url.searchParams.set(k, v);
    }
    return url;
  }

  private throwForStatus(
    status: number,
    body: string,
    path: string,
    params: Record<string, string>
  ): never {
    if (status === 401 || (status === 403 && body.includes("API key"))) {
      throw new AuthError();
    }
    if (status === 403) {
      throw new QuotaError();
    }
    if (status === 404) {
      throw new NotFoundError(this.resourceForPath(path), this.resourceIdForParams(params) ?? path);
    }
    throw new YTError(`YouTube API error (${status}): ${body}`, status);
  }

  private isRetryableStatus(status: number): boolean {
    return status === 429 || (status >= 500 && status <= 599);
  }

  private resourceForPath(path: string): string {
    const resources: Record<string, string> = {
      channels: "Channel",
      commentThreads: "CommentThread",
      comments: "Comment",
      i18nLanguages: "I18nLanguage",
      i18nRegions: "I18nRegion",
      playlistItems: "PlaylistItem",
      playlists: "Playlist",
      search: "SearchResult",
      videoCategories: "VideoCategory",
      videos: "Video",
    };
    return resources[path] ?? path;
  }

  private resourceIdForParams(params: Record<string, string>): string | undefined {
    return params.id ?? params.playlistId ?? params.parentId ?? params.channelId;
  }

  private async safeBody(res: Response): Promise<string> {
    try {
      return await res.text();
    } catch {
      return "";
    }
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
