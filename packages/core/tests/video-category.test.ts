import { beforeEach, describe, expect, it, vi } from "vitest";
import { NotFoundError } from "../src/errors.js";
import { HttpClient } from "../src/http.js";
import {
  getVideoCategories,
  getVideoCategoriesByRegion,
  getVideoCategory,
} from "../src/modules/video-category.js";

function createMockHttp(responses: Record<string, unknown>): HttpClient {
  const http = new HttpClient({ apiKey: "test-key" });

  vi.spyOn(http, "get").mockImplementation(
    async (path: string, params?: Record<string, string>) => {
      const key = buildMockKey(path, params);
      const res = responses[key] ?? responses[path];
      if (!res) throw new Error(`Unmocked request: ${key}`);
      return res;
    }
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

const CATEGORY_MUSIC = {
  id: "10",
  snippet: { channelId: "UCBR8-60-B28hp2BmDPdntcQ", title: "Music", assignable: true },
};

const CATEGORY_GAMING = {
  id: "20",
  snippet: { channelId: "UCBR8-60-B28hp2BmDPdntcQ", title: "Gaming", assignable: true },
};

const CATEGORY_TRAILER = {
  id: "44",
  snippet: { channelId: "UCBR8-60-B28hp2BmDPdntcQ", title: "Trailers", assignable: false },
};

beforeEach(() => {
  vi.restoreAllMocks();
});

describe("getVideoCategory", () => {
  it("fetches a single category by ID", async () => {
    const http = createMockHttp({
      videoCategories: { items: [CATEGORY_MUSIC] },
    });

    const cat = await getVideoCategory(http, "10");

    expect(cat.id).toBe("10");
    expect(cat.title).toBe("Music");
    expect(cat.assignable).toBe(true);
    expect(cat.channelId).toBe("UCBR8-60-B28hp2BmDPdntcQ");
  });

  it("throws NotFoundError when category does not exist", async () => {
    const http = createMockHttp({
      videoCategories: { items: [] },
    });

    await expect(getVideoCategory(http, "99999")).rejects.toThrow(NotFoundError);
  });

  it("passes correct params to http.get", async () => {
    const http = createMockHttp({
      videoCategories: { items: [CATEGORY_MUSIC] },
    });

    await getVideoCategory(http, "10");

    expect(http.get).toHaveBeenCalledWith("videoCategories", {
      part: "snippet",
      id: "10",
    });
  });
});

describe("getVideoCategories", () => {
  it("fetches multiple categories by IDs", async () => {
    const http = createMockHttp({
      videoCategories: { items: [CATEGORY_MUSIC, CATEGORY_GAMING, CATEGORY_TRAILER] },
    });

    const cats = await getVideoCategories(http, ["10", "20", "44"]);

    expect(cats).toHaveLength(3);
    expect(cats[0].title).toBe("Music");
    expect(cats[1].title).toBe("Gaming");
    expect(cats[2].title).toBe("Trailers");
    expect(cats[2].assignable).toBe(false);
  });

  it("returns empty array for empty input", async () => {
    const http = createMockHttp({});

    const cats = await getVideoCategories(http, []);

    expect(cats).toEqual([]);
    expect(http.get).not.toHaveBeenCalled();
  });

  it("returns empty array when no items found", async () => {
    const http = createMockHttp({
      videoCategories: { items: [] },
    });

    const cats = await getVideoCategories(http, ["99998", "99999"]);

    expect(cats).toEqual([]);
  });

  it("joins IDs with comma", async () => {
    const http = createMockHttp({
      videoCategories: { items: [CATEGORY_MUSIC, CATEGORY_GAMING] },
    });

    await getVideoCategories(http, ["10", "20"]);

    expect(http.get).toHaveBeenCalledWith("videoCategories", {
      part: "snippet",
      id: "10,20",
    });
  });
});

describe("getVideoCategoriesByRegion", () => {
  it("fetches categories for a region code", async () => {
    const http = createMockHttp({
      "videoCategories?part=snippet&regionCode=US": {
        items: [CATEGORY_MUSIC, CATEGORY_GAMING, CATEGORY_TRAILER],
      },
    });

    const cats = await getVideoCategoriesByRegion(http, "US");

    expect(cats).toHaveLength(3);
    expect(cats[0].title).toBe("Music");
    expect(cats[1].title).toBe("Gaming");
    expect(cats[2].title).toBe("Trailers");
  });

  it("passes hl parameter when provided", async () => {
    const http = createMockHttp({
      "videoCategories?hl=fr&part=snippet&regionCode=FR": {
        items: [
          {
            id: "10",
            snippet: { channelId: "UCBR8-60-B28hp2BmDPdntcQ", title: "Musique", assignable: true },
          },
        ],
      },
    });

    const cats = await getVideoCategoriesByRegion(http, "FR", "fr");

    expect(cats).toHaveLength(1);
    expect(cats[0].title).toBe("Musique");
    expect(http.get).toHaveBeenCalledWith("videoCategories", {
      part: "snippet",
      regionCode: "FR",
      hl: "fr",
    });
  });

  it("returns empty array when region has no items", async () => {
    const http = createMockHttp({
      "videoCategories?part=snippet&regionCode=XX": { items: [] },
    });

    const cats = await getVideoCategoriesByRegion(http, "XX");

    expect(cats).toEqual([]);
  });
});
