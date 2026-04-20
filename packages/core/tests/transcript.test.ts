import { readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";
import { listCaptionTracks, TranscriptClient, transcribeVideo } from "../src/modules/transcript.js";
import { FsCache } from "../src/transcript/cache/file-store.js";
import { InMemoryCache } from "../src/transcript/cache/memory-store.js";
import {
  TranscriptDisabledError,
  TranscriptError,
  TranscriptInvalidLangError,
  TranscriptInvalidVideoIdError,
  TranscriptLanguageError,
  TranscriptNotFoundError,
  TranscriptRateLimitError,
  TranscriptVideoUnavailableError,
} from "../src/transcript/errors.js";
import { toPlainText, toSRT, toVTT } from "../src/transcript/format.js";
import {
  decodeXmlEntities,
  parseTranscriptXml,
  resolveVideoId,
  validateLang,
} from "../src/transcript/parse.js";
import { fetchWithRetry, isRetryable } from "../src/transcript/retry.js";
import type { TranscriptLine } from "../src/transcript/types.js";

const FIXTURES = join(__dirname, "fixtures");

function fixture(name: string): string {
  return readFileSync(join(FIXTURES, name), "utf-8");
}

function fixtureJson<T>(name: string): T {
  return JSON.parse(fixture(name)) as T;
}

const TRANSCRIPT_XML = fixture("transcript.xml");
const PLAYER_SUCCESS = fixtureJson("player-success.json");
const _PLAYER_UNAVAILABLE = fixtureJson("player-unavailable.json");
const PLAYER_NO_CAPTIONS = fixtureJson("player-no-captions.json");

const WATCH_HTML_SUCCESS = `<html><body>"INNERTUBE_API_KEY":"test_api_key_123"</body></html>`;
const WATCH_HTML_RECAPTCHA = `<html><body><div class="g-recaptcha"></div></body></html>`;
const WATCH_HTML_NO_KEY = `<html><body>no api key here</body></html>`;

let _mockFetch: ReturnType<typeof vi.fn>;

function createMockFetch(responses: Array<{ url: string | RegExp; status: number; body: string }>) {
  return vi.fn(async (url: string, _init?: RequestInit) => {
    for (const r of responses) {
      if (r.url instanceof RegExp && r.url.test(url)) {
        return new Response(r.body, {
          status: r.status,
          headers: { "Content-Type": "application/json" },
        });
      }
    }
    for (const r of responses) {
      if (typeof r.url === "string" && url.includes(r.url)) {
        return new Response(r.body, { status: r.status, headers: { "Content-Type": "text/html" } });
      }
    }
    return new Response("Not Found", { status: 404 });
  });
}

beforeEach(() => {
  vi.restoreAllMocks();
});

describe("resolveVideoId", () => {
  it("returns a valid 11-char ID as-is", () => {
    expect(resolveVideoId("dQw4w9WgXcQ")).toBe("dQw4w9WgXcQ");
  });

  it("extracts ID from a watch URL", () => {
    expect(resolveVideoId("https://www.youtube.com/watch?v=dQw4w9WgXcQ")).toBe("dQw4w9WgXcQ");
  });

  it("extracts ID from a short URL", () => {
    expect(resolveVideoId("https://youtu.be/dQw4w9WgXcQ")).toBe("dQw4w9WgXcQ");
  });

  it("extracts ID from an embed URL", () => {
    expect(resolveVideoId("https://www.youtube.com/embed/dQw4w9WgXcQ")).toBe("dQw4w9WgXcQ");
  });

  it("extracts ID from a shorts URL", () => {
    expect(resolveVideoId("https://www.youtube.com/shorts/dQw4w9WgXcQ")).toBe("dQw4w9WgXcQ");
  });

  it("throws TranscriptInvalidVideoIdError for invalid input", () => {
    expect(() => resolveVideoId("invalid")).toThrow(TranscriptInvalidVideoIdError);
  });
});

describe("validateLang", () => {
  it("accepts valid BCP 47 codes", () => {
    expect(() => validateLang("en")).not.toThrow();
    expect(() => validateLang("pt-BR")).not.toThrow();
    expect(() => validateLang("zh-Hans")).not.toThrow();
  });

  it("throws TranscriptInvalidLangError for invalid codes", () => {
    expect(() => validateLang("x")).toThrow(TranscriptInvalidLangError);
    expect(() => validateLang("")).toThrow(TranscriptInvalidLangError);
  });
});

describe("decodeXmlEntities", () => {
  it("decodes common XML entities", () => {
    expect(decodeXmlEntities("&amp;")).toBe("&");
    expect(decodeXmlEntities("&lt;")).toBe("<");
    expect(decodeXmlEntities("&gt;")).toBe(">");
    expect(decodeXmlEntities("&quot;")).toBe('"');
    expect(decodeXmlEntities("&#39;")).toBe("'");
    expect(decodeXmlEntities("&apos;")).toBe("'");
  });

  it("handles mixed text with entities", () => {
    expect(decodeXmlEntities("hello &amp; world &lt;3&gt;")).toBe("hello & world <3>");
  });
});

describe("parseTranscriptXml", () => {
  it("parses XML into TranscriptLine array", () => {
    const lines = parseTranscriptXml(TRANSCRIPT_XML, "en");
    expect(lines).toHaveLength(5);
    expect(lines[0]).toEqual({
      text: "Hello and welcome to this video.",
      duration: 3.36,
      offset: 0,
      lang: "en",
    });
  });

  it("decodes XML entities in parsed text", () => {
    const lines = parseTranscriptXml(TRANSCRIPT_XML, "en");
    expect(lines[2].text).toBe("something really important & interesting.");
    expect(lines[3].text).toBe("Let's get started!");
  });

  it("returns empty array for XML with no text nodes", () => {
    const lines = parseTranscriptXml("<transcript></transcript>", "en");
    expect(lines).toHaveLength(0);
  });
});

describe("Error classes", () => {
  it("all errors extend TranscriptError", () => {
    expect(new TranscriptRateLimitError()).toBeInstanceOf(TranscriptError);
    expect(new TranscriptVideoUnavailableError("abc123")).toBeInstanceOf(TranscriptError);
    expect(new TranscriptDisabledError("abc123")).toBeInstanceOf(TranscriptError);
    expect(new TranscriptNotFoundError("abc123")).toBeInstanceOf(TranscriptError);
    expect(new TranscriptLanguageError("xx", ["en", "es"], "abc123")).toBeInstanceOf(
      TranscriptError
    );
    expect(new TranscriptInvalidVideoIdError()).toBeInstanceOf(TranscriptError);
    expect(new TranscriptInvalidLangError("x")).toBeInstanceOf(TranscriptError);
  });

  it("all errors extend Error", () => {
    expect(new TranscriptRateLimitError()).toBeInstanceOf(Error);
    expect(new TranscriptInvalidVideoIdError()).toBeInstanceOf(Error);
  });

  it("TranscriptVideoUnavailableError has videoId property", () => {
    const err = new TranscriptVideoUnavailableError("abc123");
    expect(err.videoId).toBe("abc123");
    expect(err.message).toContain("abc123");
  });

  it("TranscriptLanguageError has lang and availableLangs", () => {
    const err = new TranscriptLanguageError("de", ["en", "es", "fr"], "vid123");
    expect(err.lang).toBe("de");
    expect(err.availableLangs).toEqual(["en", "es", "fr"]);
    expect(err.videoId).toBe("vid123");
  });

  it("TranscriptInvalidLangError has lang property", () => {
    const err = new TranscriptInvalidLangError("invalid!!");
    expect(err.lang).toBe("invalid!!");
  });

  it("error names are set correctly", () => {
    expect(new TranscriptRateLimitError().name).toBe("TranscriptRateLimitError");
    expect(new TranscriptVideoUnavailableError("x").name).toBe("TranscriptVideoUnavailableError");
    expect(new TranscriptDisabledError("x").name).toBe("TranscriptDisabledError");
    expect(new TranscriptNotFoundError("x").name).toBe("TranscriptNotFoundError");
    expect(new TranscriptLanguageError("x", [], "x").name).toBe("TranscriptLanguageError");
    expect(new TranscriptInvalidVideoIdError().name).toBe("TranscriptInvalidVideoIdError");
    expect(new TranscriptInvalidLangError("x").name).toBe("TranscriptInvalidLangError");
  });
});

describe("Format functions", () => {
  const lines: TranscriptLine[] = [
    { text: "Hello world.", duration: 2.5, offset: 0, lang: "en" },
    { text: "Goodbye.", duration: 1.5, offset: 2.5, lang: "en" },
  ];

  describe("toSRT", () => {
    it("produces valid SRT format", () => {
      const srt = toSRT(lines);
      expect(srt).toContain("1\n00:00:00,000 --> 00:00:02,500\nHello world.");
      expect(srt).toContain("2\n00:00:02,500 --> 00:00:04,000\nGoodbye.");
    });
  });

  describe("toVTT", () => {
    it("produces valid VTT format with header", () => {
      const vtt = toVTT(lines);
      expect(vtt).toContain("WEBVTT");
      expect(vtt).toContain("00:00:00.000 --> 00:00:02.500\nHello world.");
    });
  });

  describe("toPlainText", () => {
    it("joins text with newline by default", () => {
      expect(toPlainText(lines)).toBe("Hello world.\nGoodbye.");
    });

    it("joins with custom separator", () => {
      expect(toPlainText(lines, " ")).toBe("Hello world. Goodbye.");
    });
  });
});

describe("transcribeVideo (integration with mocked fetch)", () => {
  it("fetches transcript for a valid video", async () => {
    const mockFetch = createMockFetch([
      { url: "youtube.com/watch", status: 200, body: WATCH_HTML_SUCCESS },
      { url: /youtubei\/v1\/player/, status: 200, body: JSON.stringify(PLAYER_SUCCESS) },
      { url: "api/timedtext", status: 200, body: TRANSCRIPT_XML },
    ]);

    const result = await transcribeVideo("dQw4w9WgXcQ", {
      customFetch: mockFetch,
    });

    const lines = result as TranscriptLine[];
    expect(lines).toHaveLength(5);
    expect(lines[0].text).toBe("Hello and welcome to this video.");
    expect(lines[0].lang).toBe("en");
  });

  it("fetches transcript with a specific language", async () => {
    const mockFetch = createMockFetch([
      { url: "youtube.com/watch", status: 200, body: WATCH_HTML_SUCCESS },
      { url: /youtubei\/v1\/player/, status: 200, body: JSON.stringify(PLAYER_SUCCESS) },
      { url: "api/timedtext", status: 200, body: TRANSCRIPT_XML },
    ]);

    const result = await transcribeVideo("dQw4w9WgXcQ", {
      lang: "es",
      customFetch: mockFetch,
    });

    const lines = result as TranscriptLine[];
    expect(lines[0].lang).toBe("es");
  });

  it("fetches transcript with metadata when includeMeta is true", async () => {
    const mockFetch = createMockFetch([
      { url: "youtube.com/watch", status: 200, body: WATCH_HTML_SUCCESS },
      { url: /youtubei\/v1\/player/, status: 200, body: JSON.stringify(PLAYER_SUCCESS) },
      { url: "api/timedtext", status: 200, body: TRANSCRIPT_XML },
    ]);

    const result = await transcribeVideo("dQw4w9WgXcQ", {
      includeMeta: true,
      customFetch: mockFetch,
    });

    expect(result).toHaveProperty("meta");
    expect(result).toHaveProperty("lines");
    const res = result as { meta: unknown; lines: TranscriptLine[] };
    expect(res.meta).toBeDefined();
    expect(res.lines).toHaveLength(5);
  });

  it("throws TranscriptVideoUnavailableError for non-OK watch page", async () => {
    const mockFetch = createMockFetch([
      { url: "youtube.com/watch", status: 404, body: "Not Found" },
    ]);

    await expect(transcribeVideo("dQw4w9WgXcQ", { customFetch: mockFetch })).rejects.toThrow(
      TranscriptVideoUnavailableError
    );
  });

  it("throws TranscriptRateLimitError on reCAPTCHA page", async () => {
    const mockFetch = createMockFetch([
      { url: "youtube.com/watch", status: 200, body: WATCH_HTML_RECAPTCHA },
    ]);

    await expect(transcribeVideo("dQw4w9WgXcQ", { customFetch: mockFetch })).rejects.toThrow(
      TranscriptRateLimitError
    );
  });

  it("throws TranscriptNotFoundError when no API key in page", async () => {
    const mockFetch = createMockFetch([
      { url: "youtube.com/watch", status: 200, body: WATCH_HTML_NO_KEY },
    ]);

    await expect(transcribeVideo("dQw4w9WgXcQ", { customFetch: mockFetch })).rejects.toThrow(
      TranscriptNotFoundError
    );
  });

  it("throws TranscriptDisabledError when captions are disabled", async () => {
    const mockFetch = createMockFetch([
      { url: "youtube.com/watch", status: 200, body: WATCH_HTML_SUCCESS },
      { url: /youtubei\/v1\/player/, status: 200, body: JSON.stringify(PLAYER_NO_CAPTIONS) },
    ]);

    await expect(transcribeVideo("disabledCap", { customFetch: mockFetch })).rejects.toThrow(
      TranscriptDisabledError
    );
  });

  it("throws TranscriptLanguageError for unavailable language", async () => {
    const mockFetch = createMockFetch([
      { url: "youtube.com/watch", status: 200, body: WATCH_HTML_SUCCESS },
      { url: /youtubei\/v1\/player/, status: 200, body: JSON.stringify(PLAYER_SUCCESS) },
    ]);

    await expect(
      transcribeVideo("dQw4w9WgXcQ", { lang: "de", customFetch: mockFetch })
    ).rejects.toThrow(TranscriptLanguageError);
  });

  it("throws TranscriptInvalidVideoIdError for bad input", async () => {
    await expect(transcribeVideo("bad", { customFetch: vi.fn() })).rejects.toThrow(
      TranscriptInvalidVideoIdError
    );
  });

  it("throws TranscriptInvalidLangError for bad language code", async () => {
    await expect(
      transcribeVideo("dQw4w9WgXcQ", { lang: "x", customFetch: vi.fn() })
    ).rejects.toThrow(TranscriptInvalidLangError);
  });

  it("strips fmt query param from transcript URL", async () => {
    const mockFetch = createMockFetch([
      { url: "youtube.com/watch", status: 200, body: WATCH_HTML_SUCCESS },
      { url: /youtubei\/v1\/player/, status: 200, body: JSON.stringify(PLAYER_SUCCESS) },
      { url: "api/timedtext", status: 200, body: TRANSCRIPT_XML },
    ]);

    await transcribeVideo("dQw4w9WgXcQ", { customFetch: mockFetch });

    const transcriptCall = mockFetch.mock.calls.find(
      (call: unknown[]) =>
        typeof call[0] === "string" && (call[0] as string).includes("api/timedtext")
    );
    expect(transcriptCall).toBeDefined();
    expect(transcriptCall![0] as string).not.toContain("&fmt=");
  });
});

describe("listCaptionTracks", () => {
  it("returns available caption tracks", async () => {
    const mockFetch = createMockFetch([
      { url: "youtube.com/watch", status: 200, body: WATCH_HTML_SUCCESS },
      { url: /youtubei\/v1\/player/, status: 200, body: JSON.stringify(PLAYER_SUCCESS) },
    ]);

    const tracks = await listCaptionTracks("dQw4w9WgXcQ", {
      customFetch: mockFetch,
    });

    expect(tracks).toHaveLength(2);
    expect(tracks[0]).toEqual({
      languageCode: "en",
      languageName: "English",
      isAutoGenerated: true,
    });
    expect(tracks[1]).toEqual({
      languageCode: "es",
      languageName: "Spanish",
      isAutoGenerated: false,
    });
  });
});

describe("TranscriptClient", () => {
  it("merges defaults with overrides", async () => {
    const mockFetch = createMockFetch([
      { url: "youtube.com/watch", status: 200, body: WATCH_HTML_SUCCESS },
      { url: /youtubei\/v1\/player/, status: 200, body: JSON.stringify(PLAYER_SUCCESS) },
      { url: "api/timedtext", status: 200, body: TRANSCRIPT_XML },
    ]);

    const client = new TranscriptClient({ customFetch: mockFetch });
    const result = await client.transcribe("dQw4w9WgXcQ");

    const lines = result as TranscriptLine[];
    expect(lines).toHaveLength(5);
  });

  it("availableTracks returns caption list", async () => {
    const mockFetch = createMockFetch([
      { url: "youtube.com/watch", status: 200, body: WATCH_HTML_SUCCESS },
      { url: /youtubei\/v1\/player/, status: 200, body: JSON.stringify(PLAYER_SUCCESS) },
    ]);

    const client = new TranscriptClient({ customFetch: mockFetch });
    const tracks = await client.availableTracks("dQw4w9WgXcQ");

    expect(tracks).toHaveLength(2);
    expect(tracks[0].languageCode).toBe("en");
  });
});

describe("InMemoryCache", () => {
  it("stores and retrieves values", async () => {
    const cache = new InMemoryCache();
    await cache.set("key1", "value1");
    expect(await cache.get("key1")).toBe("value1");
  });

  it("returns null for missing keys", async () => {
    const cache = new InMemoryCache();
    expect(await cache.get("missing")).toBeNull();
  });

  it("expires entries based on TTL", async () => {
    const cache = new InMemoryCache(60000);
    await cache.set("key1", "value1", 1);
    await new Promise((r) => setTimeout(r, 10));
    expect(await cache.get("key1")).toBeNull();
  });

  it("uses default TTL when none provided to set()", async () => {
    const cache = new InMemoryCache(1);
    await cache.set("key1", "value1");
    await new Promise((r) => setTimeout(r, 10));
    expect(await cache.get("key1")).toBeNull();
  });

  it("evicts oldest entry when maxEntries is exceeded", async () => {
    const cache = new InMemoryCache(60000, 3);
    await cache.set("a", "1");
    await cache.set("b", "2");
    await cache.set("c", "3");
    await cache.set("d", "4");
    expect(await cache.get("a")).toBeNull();
    expect(await cache.get("d")).toBe("4");
    expect(cache.size).toBe(3);
  });

  it("clear() removes all entries", async () => {
    const cache = new InMemoryCache();
    await cache.set("a", "1");
    await cache.set("b", "2");
    cache.clear();
    expect(cache.size).toBe(0);
    expect(await cache.get("a")).toBeNull();
  });

  it("size getter returns current count", async () => {
    const cache = newMemoryCache();
    expect(cache.size).toBe(0);
    await cache.set("a", "1");
    expect(cache.size).toBe(1);
  });
});

function newMemoryCache() {
  return new InMemoryCache();
}

describe("FsCache", () => {
  const testCacheDir = join(tmpdir(), `lyra-test-fscache-${Date.now()}`);

  afterAll(() => {
    rmSync(testCacheDir, { recursive: true, force: true });
  });

  it("stores and retrieves values", async () => {
    const cache = new FsCache(testCacheDir);
    await cache.set("key1", "value1");
    expect(await cache.get("key1")).toBe("value1");
  });

  it("returns null for missing keys", async () => {
    const cache = new FsCache(testCacheDir);
    expect(await cache.get("nonexistent_key_xyz")).toBeNull();
  });

  it("expires entries based on TTL", async () => {
    const cache = new FsCache(testCacheDir);
    await cache.set("expiring", "gone", 1);
    await new Promise((r) => setTimeout(r, 10));
    expect(await cache.get("expiring")).toBeNull();
  });

  it("clear() removes all cache files", async () => {
    const subDir = join(tmpdir(), `lyra-test-clear-${Date.now()}`);
    const cache = new FsCache(subDir);
    await cache.set("a", "1");
    await cache.set("b", "2");
    await cache.clear();
    expect(await cache.get("a")).toBeNull();
    expect(await cache.get("b")).toBeNull();
    rmSync(subDir, { recursive: true, force: true });
  });

  it("handles concurrent operations", async () => {
    const cache = new FsCache(testCacheDir);
    await Promise.all([cache.set("c1", "v1"), cache.set("c2", "v2"), cache.set("c3", "v3")]);
    expect(await cache.get("c1")).toBe("v1");
    expect(await cache.get("c2")).toBe("v2");
    expect(await cache.get("c3")).toBe("v3");
  });
});

describe("Cache integration with fetchTranscript", () => {
  it("returns cached result on second call without fetching", async () => {
    let fetchCount = 0;
    const mockFetch = vi.fn(async (url: string) => {
      fetchCount++;
      if (url.includes("api/timedtext")) {
        return new Response(TRANSCRIPT_XML, { status: 200 });
      }
      if (/youtubei\/v1\/player/.test(url)) {
        return new Response(JSON.stringify(PLAYER_SUCCESS), { status: 200 });
      }
      if (url.includes("youtube.com/watch")) {
        return new Response(WATCH_HTML_SUCCESS, { status: 200 });
      }
      return new Response("Not Found", { status: 404 });
    });

    const cache = new InMemoryCache();

    const result1 = await transcribeVideo("dQw4w9WgXcQ", {
      cache,
      customFetch: mockFetch,
    });

    expect(fetchCount).toBe(3);

    const result2 = await transcribeVideo("dQw4w9WgXcQ", {
      cache,
      customFetch: mockFetch,
    });

    expect(fetchCount).toBe(3);
    expect(result1).toEqual(result2);
  });

  it("caches differently for different languages", async () => {
    const mockFetch = vi.fn(async (url: string) => {
      if (url.includes("api/timedtext")) {
        return new Response(TRANSCRIPT_XML, { status: 200 });
      }
      if (/youtubei\/v1\/player/.test(url)) {
        return new Response(JSON.stringify(PLAYER_SUCCESS), { status: 200 });
      }
      return new Response(WATCH_HTML_SUCCESS, { status: 200 });
    });

    const cache = new InMemoryCache();

    await transcribeVideo("dQw4w9WgXcQ", { lang: "en", cache, customFetch: mockFetch });
    await transcribeVideo("dQw4w9WgXcQ", { lang: "es", cache, customFetch: mockFetch });

    expect(cache.size).toBe(2);
  });

  it("uses separate cache keys for includeMeta", async () => {
    const mockFetch = vi.fn(async (url: string) => {
      if (url.includes("api/timedtext")) {
        return new Response(TRANSCRIPT_XML, { status: 200 });
      }
      if (/youtubei\/v1\/player/.test(url)) {
        return new Response(JSON.stringify(PLAYER_SUCCESS), { status: 200 });
      }
      return new Response(WATCH_HTML_SUCCESS, { status: 200 });
    });

    const cache = new InMemoryCache();

    await transcribeVideo("dQw4w9WgXcQ", { cache, customFetch: mockFetch });
    await transcribeVideo("dQw4w9WgXcQ", { includeMeta: true, cache, customFetch: mockFetch });

    expect(cache.size).toBe(2);
  });
});

describe("Retry logic", () => {
  it("isRetryable identifies 429 and 5xx", () => {
    expect(isRetryable(429)).toBe(true);
    expect(isRetryable(500)).toBe(true);
    expect(isRetryable(503)).toBe(true);
    expect(isRetryable(200)).toBe(false);
    expect(isRetryable(400)).toBe(false);
    expect(isRetryable(404)).toBe(false);
  });

  it("returns immediately on success", async () => {
    const fn = vi.fn(async () => new Response("ok", { status: 200 }));
    const res = await fetchWithRetry(fn, 3, 10);
    expect(res.status).toBe(200);
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it("retries on 429 and eventually succeeds", async () => {
    let call = 0;
    const fn = vi.fn(async () => {
      call++;
      if (call <= 2) return new Response("rate limited", { status: 429 });
      return new Response("ok", { status: 200 });
    });

    const res = await fetchWithRetry(fn, 3, 1);
    expect(res.status).toBe(200);
    expect(fn).toHaveBeenCalledTimes(3);
  });

  it("retries on 5xx and eventually succeeds", async () => {
    let call = 0;
    const fn = vi.fn(async () => {
      call++;
      if (call === 1) return new Response("error", { status: 500 });
      return new Response("ok", { status: 200 });
    });

    const res = await fetchWithRetry(fn, 2, 1);
    expect(res.status).toBe(200);
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it("returns last response when retries exhausted", async () => {
    const fn = vi.fn(async () => new Response("still failing", { status: 503 }));
    const res = await fetchWithRetry(fn, 2, 1);
    expect(res.status).toBe(503);
    expect(fn).toHaveBeenCalledTimes(3);
  });

  it("does not retry on 4xx (except 429)", async () => {
    const fn = vi.fn(async () => new Response("not found", { status: 404 }));
    const res = await fetchWithRetry(fn, 3, 1);
    expect(res.status).toBe(404);
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it("respects AbortSignal between retries", async () => {
    const controller = new AbortController();
    const fn = vi.fn(async () => new Response("rate limited", { status: 429 }));

    setTimeout(() => controller.abort(), 5);

    await expect(fetchWithRetry(fn, 5, 50, controller.signal)).rejects.toThrow();

    expect(fn.mock.calls.length).toBeLessThan(5);
  });

  it("retries are applied in transcribeVideo with retries option", async () => {
    let watchCall = 0;
    const mockFetch = vi.fn(async (url: string) => {
      if (url.includes("youtube.com/watch")) {
        watchCall++;
        if (watchCall === 1) return new Response("rate limited", { status: 429 });
        return new Response(WATCH_HTML_SUCCESS, { status: 200 });
      }
      if (/youtubei\/v1\/player/.test(url)) {
        return new Response(JSON.stringify(PLAYER_SUCCESS), { status: 200 });
      }
      if (url.includes("api/timedtext")) {
        return new Response(TRANSCRIPT_XML, { status: 200 });
      }
      return new Response("Not Found", { status: 404 });
    });

    const lines = await transcribeVideo("dQw4w9WgXcQ", {
      retries: 2,
      retryDelay: 1,
      customFetch: mockFetch,
    });

    expect((lines as TranscriptLine[]).length).toBeGreaterThan(0);
    expect(watchCall).toBe(2);
  });
});
