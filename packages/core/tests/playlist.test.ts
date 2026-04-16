import { describe, expect, it, vi } from "vitest";
import { HttpClient } from "../src/http";
import { getPlaylist, getPlaylistInfo, getPlaylistVideoIds } from "../src/modules/playlist";

// ---------------------------------------------------------------------------
// Mocked HttpClient
// ---------------------------------------------------------------------------

function createMockHttp(responses: Record<string, unknown>): HttpClient {
  const http = new HttpClient({ apiKey: "test-key" });

  vi.spyOn(http, "get").mockImplementation(
    async (path: string, params?: Record<string, string>) => {
      const key = buildMockKey(path, params);
      const res = responses[key] ?? responses[path];
      if (!res) {
        throw new Error(`Unmocked request: ${key}`);
      }
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

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const PLAYLIST_INFO_RESPONSE = {
  items: [
    {
      id: "PLtest123",
      snippet: {
        title: "Test Playlist",
        description: "A test playlist",
        thumbnails: {
          default: {
            url: "https://img.youtube.com/default.jpg",
            width: 120,
            height: 90,
          },
          medium: {
            url: "https://img.youtube.com/medium.jpg",
            width: 320,
            height: 180,
          },
          high: {
            url: "https://img.youtube.com/high.jpg",
            width: 480,
            height: 360,
          },
        },
      },
    },
  ],
};

const PLAYLIST_ITEMS_PAGE1 = {
  items: [
    { contentDetails: { videoId: "vid1" } },
    { contentDetails: { videoId: "vid2" } },
    { contentDetails: { videoId: "vid3" } },
  ],
  nextPageToken: undefined,
};

const PLAYLIST_ITEMS_PAGINATED_PAGE1 = {
  items: [{ contentDetails: { videoId: "vid1" } }, { contentDetails: { videoId: "vid2" } }],
  nextPageToken: "PAGE2_TOKEN",
};

const PLAYLIST_ITEMS_PAGINATED_PAGE2 = {
  items: [{ contentDetails: { videoId: "vid3" } }],
  nextPageToken: undefined,
};

function makeVideoDetailsResponse(ids: string[]) {
  return {
    items: ids.map((id, i) => ({
      id,
      snippet: {
        title: `Video ${id}`,
        description: `Description for ${id}`,
        channelTitle: "Test Channel",
        publishedAt: `2024-0${i + 1}-15T12:00:00Z`,
        thumbnails: {
          default: {
            url: `https://img.youtube.com/${id}/default.jpg`,
            width: 120,
            height: 90,
          },
          medium: {
            url: `https://img.youtube.com/${id}/medium.jpg`,
            width: 320,
            height: 180,
          },
          high: {
            url: `https://img.youtube.com/${id}/high.jpg`,
            width: 480,
            height: 360,
          },
        },
      },
      statistics: {
        viewCount: `${(i + 1) * 1000}`,
        likeCount: `${(i + 1) * 100}`,
      },
      contentDetails: {
        duration: `PT${(i + 1) * 10}M0S`,
      },
    })),
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("getPlaylistInfo", () => {
  it("fetches playlist metadata by ID", async () => {
    const http = createMockHttp({ playlists: PLAYLIST_INFO_RESPONSE });

    const info = await getPlaylistInfo(http, "PLtest123");

    expect(info.id).toBe("PLtest123");
    expect(info.title).toBe("Test Playlist");
    expect(info.description).toBe("A test playlist");
    expect(info.thumbnails.high.url).toContain("high.jpg");
  });

  it("extracts playlist ID from URL", async () => {
    const http = createMockHttp({ playlists: PLAYLIST_INFO_RESPONSE });

    const info = await getPlaylistInfo(http, "https://www.youtube.com/playlist?list=PLtest123");

    expect(info.id).toBe("PLtest123");
    expect(http.get).toHaveBeenCalledWith("playlists", {
      part: "snippet",
      id: "PLtest123",
    });
  });

  it("throws NotFoundError for missing playlist", async () => {
    const http = createMockHttp({ playlists: { items: [] } });

    await expect(getPlaylistInfo(http, "PLnotfound")).rejects.toThrow("not found");
  });
});

describe("getPlaylistVideoIds", () => {
  it("collects video IDs from a single page", async () => {
    const http = createMockHttp({ playlistItems: PLAYLIST_ITEMS_PAGE1 });

    const ids = await getPlaylistVideoIds(http, "PLtest123");

    expect(ids).toEqual(["vid1", "vid2", "vid3"]);
  });

  it("auto-paginates across multiple pages", async () => {
    const http = new HttpClient({ apiKey: "test-key" });
    let callCount = 0;

    vi.spyOn(http, "get").mockImplementation(
      async (path: string, _params?: Record<string, string>) => {
        if (path === "playlistItems") {
          callCount++;
          if (callCount === 1) return PLAYLIST_ITEMS_PAGINATED_PAGE1;
          return PLAYLIST_ITEMS_PAGINATED_PAGE2;
        }
        throw new Error(`Unexpected path: ${path}`);
      }
    );

    const ids = await getPlaylistVideoIds(http, "PLtest123");

    expect(ids).toEqual(["vid1", "vid2", "vid3"]);
    expect(http.get).toHaveBeenCalledTimes(2);
  });

  it("extracts playlist ID from watch URL with list param", async () => {
    const http = createMockHttp({ playlistItems: PLAYLIST_ITEMS_PAGE1 });

    const ids = await getPlaylistVideoIds(http, "https://youtube.com/watch?v=xyz&list=PLtest123");

    expect(ids).toEqual(["vid1", "vid2", "vid3"]);
  });
});

describe("getPlaylist", () => {
  it("fetches complete playlist with metadata, videos, and aggregated stats", async () => {
    const http = new HttpClient({ apiKey: "test-key" });

    vi.spyOn(http, "get").mockImplementation(
      async (path: string, _params?: Record<string, string>) => {
        if (path === "playlists") return PLAYLIST_INFO_RESPONSE;
        if (path === "playlistItems") return PLAYLIST_ITEMS_PAGE1;
        if (path === "videos") return makeVideoDetailsResponse(["vid1", "vid2", "vid3"]);
        throw new Error(`Unexpected path: ${path}`);
      }
    );

    const playlist = await getPlaylist(http, "PLtest123");

    expect(playlist.id).toBe("PLtest123");
    expect(playlist.title).toBe("Test Playlist");

    expect(playlist.videoCount).toBe(3);
    expect(playlist.videos).toHaveLength(3);
    expect(playlist.videos[0].title).toBe("Video vid1");
    expect(playlist.videos[1].title).toBe("Video vid2");
    expect(playlist.videos[2].title).toBe("Video vid3");

    expect(playlist.videos[0].views).toBe(1000);
    expect(playlist.videos[0].viewsFmt).toMatch(/1K/);
    expect(playlist.videos[0].likes).toBe(100);

    expect(playlist.videos[0].duration).toBe(600);
    expect(playlist.videos[0].durationFmt).toBe("10:00");
    expect(playlist.videos[1].duration).toBe(1200);
    expect(playlist.videos[2].duration).toBe(1800);

    expect(playlist.totalDuration).toBe(3600);
    expect(playlist.totalDurationFmt).toBe("1h");
  });

  it("returns empty videos for empty playlist", async () => {
    const http = new HttpClient({ apiKey: "test-key" });

    vi.spyOn(http, "get").mockImplementation(async (path: string) => {
      if (path === "playlists") return PLAYLIST_INFO_RESPONSE;
      if (path === "playlistItems") return { items: [] };
      if (path === "videos") return { items: [] };
      throw new Error(`Unexpected path: ${path}`);
    });

    const playlist = await getPlaylist(http, "PLtest123");

    expect(playlist.videoCount).toBe(0);
    expect(playlist.videos).toEqual([]);
    expect(playlist.totalDuration).toBe(0);
    expect(playlist.totalDurationFmt).toBe("0s");
  });

  it("preserves publishedAt as Date objects", async () => {
    const http = new HttpClient({ apiKey: "test-key" });

    vi.spyOn(http, "get").mockImplementation(async (path: string) => {
      if (path === "playlists") return PLAYLIST_INFO_RESPONSE;
      if (path === "playlistItems")
        return {
          items: [{ contentDetails: { videoId: "vid1" } }],
          nextPageToken: undefined,
        };
      if (path === "videos") return makeVideoDetailsResponse(["vid1"]);
      throw new Error(`Unexpected path: ${path}`);
    });

    const playlist = await getPlaylist(http, "PLtest123");

    expect(playlist.videos[0].publishedAt).toBeInstanceOf(Date);
  });
});
