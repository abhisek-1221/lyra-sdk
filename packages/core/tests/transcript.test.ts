import { readFileSync } from "node:fs";
import { join } from "node:path";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { listCaptionTracks, TranscriptClient, transcribeVideo } from "../src/modules/transcript.js";
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
