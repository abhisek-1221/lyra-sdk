import { beforeEach, describe, expect, it, vi } from "vitest";
import { HttpClient } from "../src/http.js";
import { getLanguages, getRegions } from "../src/modules/i18n.js";

function createMockHttp(responses: Record<string, unknown>): HttpClient {
  const http = new HttpClient({ apiKey: "test-key" });

  vi.spyOn(http, "get").mockImplementation(
    async (path: string, params?: Record<string, string>) => {
      const key = buildMockKey(path, params);
      const res = responses[key] ?? responses[path];
      if (!res) throw new Error(`Unmocked request: ${key}`);
      return res;
    },
  );

  return http;
}

function buildMockKey(path: string, params?: Record<string, string>): string {
  if (!params) return path;
  const sorted = Object.entries(params)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([k, v]) => `${k}=${v}`)
    .join("&");
  return `${path}?${sorted}`;
}

const REGIONS_RESPONSE = {
  items: [
    { id: "US", snippet: { gl: "US", name: "United States" } },
    { id: "GB", snippet: { gl: "GB", name: "United Kingdom" } },
    { id: "IN", snippet: { gl: "IN", name: "India" } },
  ],
};

const LANGUAGES_RESPONSE = {
  items: [
    { id: "en", snippet: { hl: "en", name: "English" } },
    { id: "fr", snippet: { hl: "fr", name: "French" } },
    { id: "zh-Hans", snippet: { hl: "zh-Hans", name: "Chinese (Simplified)" } },
  ],
};

beforeEach(() => {
  vi.restoreAllMocks();
});

describe("getRegions", () => {
  it("fetches all supported regions", async () => {
    const http = createMockHttp({ i18nRegions: REGIONS_RESPONSE });

    const regions = await getRegions(http);

    expect(regions).toHaveLength(3);
    expect(regions[0]).toEqual({ id: "US", gl: "US", name: "United States" });
    expect(regions[1]).toEqual({ id: "GB", gl: "GB", name: "United Kingdom" });
    expect(regions[2]).toEqual({ id: "IN", gl: "IN", name: "India" });
  });

  it("passes hl parameter when provided", async () => {
    const http = createMockHttp({
      "i18nRegions?hl=fr&part=snippet": {
        items: [
          { id: "US", snippet: { gl: "US", name: "États-Unis" } },
        ],
      },
    });

    const regions = await getRegions(http, "fr");

    expect(regions).toHaveLength(1);
    expect(regions[0].name).toBe("États-Unis");
    expect(http.get).toHaveBeenCalledWith("i18nRegions", {
      part: "snippet",
      hl: "fr",
    });
  });

  it("returns empty array when no items", async () => {
    const http = createMockHttp({ i18nRegions: { items: [] } });

    const regions = await getRegions(http);

    expect(regions).toEqual([]);
  });

  it("calls with part=snippet only when hl is omitted", async () => {
    const http = createMockHttp({ i18nRegions: REGIONS_RESPONSE });

    await getRegions(http);

    expect(http.get).toHaveBeenCalledWith("i18nRegions", { part: "snippet" });
  });
});

describe("getLanguages", () => {
  it("fetches all supported languages", async () => {
    const http = createMockHttp({ i18nLanguages: LANGUAGES_RESPONSE });

    const languages = await getLanguages(http);

    expect(languages).toHaveLength(3);
    expect(languages[0]).toEqual({ id: "en", hl: "en", name: "English" });
    expect(languages[1]).toEqual({ id: "fr", hl: "fr", name: "French" });
    expect(languages[2]).toEqual({ id: "zh-Hans", hl: "zh-Hans", name: "Chinese (Simplified)" });
  });

  it("passes hl parameter when provided", async () => {
    const http = createMockHttp({
      "i18nLanguages?hl=fr&part=snippet": {
        items: [
          { id: "en", snippet: { hl: "en", name: "Anglais" } },
        ],
      },
    });

    const languages = await getLanguages(http, "fr");

    expect(languages).toHaveLength(1);
    expect(languages[0].name).toBe("Anglais");
    expect(http.get).toHaveBeenCalledWith("i18nLanguages", {
      part: "snippet",
      hl: "fr",
    });
  });

  it("returns empty array when no items", async () => {
    const http = createMockHttp({ i18nLanguages: { items: [] } });

    const languages = await getLanguages(http);

    expect(languages).toEqual([]);
  });

  it("calls with part=snippet only when hl is omitted", async () => {
    const http = createMockHttp({ i18nLanguages: LANGUAGES_RESPONSE });

    await getLanguages(http);

    expect(http.get).toHaveBeenCalledWith("i18nLanguages", { part: "snippet" });
  });
});
