import { describe, expect, it, vi, beforeEach } from "vitest";
import { HttpClient } from "../src/http";
import { PlaylistQueryBuilder } from "../src/modules/playlist-query";

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

const PLAYLIST_ITEMS_PAGE = {
  items: [
    { contentDetails: { videoId: "vid1" } },
    { contentDetails: { videoId: "vid2" } },
    { contentDetails: { videoId: "vid3" } },
    { contentDetails: { videoId: "vid4" } },
    { contentDetails: { videoId: "vid5" } },
  ],
  nextPageToken: undefined,
};

function makeVideoDetailsResponse(
  ids: string[],
  durations: number[],
  views: number[],
  likes: number[]
) {
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
        viewCount: `${views[i]}`,
        likeCount: `${likes[i]}`,
      },
      contentDetails: {
        duration: `PT${durations[i]}M0S`,
      },
    })),
  };
}

// ---------------------------------------------------------------------------
// Mocked HttpClient
// ---------------------------------------------------------------------------

function createMockHttp(): HttpClient {
  const http = new HttpClient({ apiKey: "test-key" });

  vi.spyOn(http, "get").mockImplementation(async (path: string) => {
    if (path === "playlists") return PLAYLIST_INFO_RESPONSE;
    if (path === "playlistItems") return PLAYLIST_ITEMS_PAGE;
    if (path === "videos") {
      return makeVideoDetailsResponse(
        ["vid1", "vid2", "vid3", "vid4", "vid5"],
        [10, 5, 20, 15, 30], // durations in minutes
        [1000, 500, 2000, 1500, 3000], // views
        [100, 50, 200, 150, 300] // likes
      );
    }
    throw new Error(`Unexpected path: ${path}`);
  });

  return http;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("PlaylistQueryBuilder", () => {
  let http: HttpClient;

  beforeEach(() => {
    http = createMockHttp();
  });

  describe("filterByDuration", () => {
    it("filters videos with duration >= min", async () => {
      const result = await new PlaylistQueryBuilder(http, "PLtest123")
        .filterByDuration({ min: 15 * 60 })
        .execute();

      // Duration [10, 5, 20, 15, 30] min -> videos 3, 4, 5 pass (>= 15 min)
      expect(result.videos.length).toBe(3);
      expect(result.videos.every((v) => v.duration >= 15 * 60)).toBe(true);
    });

    it("filters videos with duration <= max", async () => {
      const result = await new PlaylistQueryBuilder(http, "PLtest123")
        .filterByDuration({ max: 10 * 60 })
        .execute();

      // Duration [10, 5, 20, 15, 30] min -> videos 1, 2 pass (<= 10 min)
      expect(result.videos.length).toBe(2);
    });

    it("combines min and max duration filters", async () => {
      const result = await new PlaylistQueryBuilder(http, "PLtest123")
        .filterByDuration({ min: 10 * 60, max: 20 * 60 })
        .execute();

      // Duration [10, 5, 20, 15, 30] min -> videos 1, 3, 4 pass (10-20 min)
      expect(result.videos.length).toBe(3);
    });
  });

  describe("filterByViews", () => {
    it("filters videos with views >= min", async () => {
      const result = await new PlaylistQueryBuilder(http, "PLtest123")
        .filterByViews({ min: 1500 })
        .execute();

      // Views [1000, 500, 2000, 1500, 3000] -> videos 3, 4, 5 pass (>= 1500)
      expect(result.videos.length).toBe(3);
    });

    it("filters videos with views <= max", async () => {
      const result = await new PlaylistQueryBuilder(http, "PLtest123")
        .filterByViews({ max: 1000 })
        .execute();

      // Views [1000, 500, 2000, 1500, 3000] -> videos 1, 2 pass (<= 1000)
      expect(result.videos.length).toBe(2);
    });
  });

  describe("filterByLikes", () => {
    it("filters videos with likes >= min", async () => {
      const result = await new PlaylistQueryBuilder(http, "PLtest123")
        .filterByLikes({ min: 150 })
        .execute();

      // Likes [100, 50, 200, 150, 300] -> videos 3, 4, 5 pass (>= 150)
      expect(result.videos.length).toBe(3);
    });

    it("filters videos with likes <= max", async () => {
      const result = await new PlaylistQueryBuilder(http, "PLtest123")
        .filterByLikes({ max: 100 })
        .execute();

      // Likes [100, 50, 200, 150, 300] -> videos 1, 2 pass (<= 100)
      expect(result.videos.length).toBe(2);
    });
  });

  describe("sortBy", () => {
    it("sorts by duration ascending", async () => {
      const result = await new PlaylistQueryBuilder(http, "PLtest123")
        .sortBy("duration", "asc")
        .execute();

      expect(result.videos[0].duration).toBe(5 * 60); // shortest
      expect(result.videos[4].duration).toBe(30 * 60); // longest
    });

    it("sorts by duration descending", async () => {
      const result = await new PlaylistQueryBuilder(http, "PLtest123")
        .sortBy("duration", "desc")
        .execute();

      expect(result.videos[0].duration).toBe(30 * 60); // longest
      expect(result.videos[4].duration).toBe(5 * 60); // shortest
    });

    it("sorts by views ascending", async () => {
      const result = await new PlaylistQueryBuilder(http, "PLtest123")
        .sortBy("views", "asc")
        .execute();

      expect(result.videos[0].views).toBe(500);
      expect(result.videos[4].views).toBe(3000);
    });

    it("sorts by views descending", async () => {
      const result = await new PlaylistQueryBuilder(http, "PLtest123")
        .sortBy("views", "desc")
        .execute();

      expect(result.videos[0].views).toBe(3000);
      expect(result.videos[4].views).toBe(500);
    });

    it("sorts by likes ascending", async () => {
      const result = await new PlaylistQueryBuilder(http, "PLtest123")
        .sortBy("likes", "asc")
        .execute();

      expect(result.videos[0].likes).toBe(50);
      expect(result.videos[4].likes).toBe(300);
    });

    it("sorts by likes descending", async () => {
      const result = await new PlaylistQueryBuilder(http, "PLtest123")
        .sortBy("likes", "desc")
        .execute();

      expect(result.videos[0].likes).toBe(300);
      expect(result.videos[4].likes).toBe(50);
    });
  });

  describe("between", () => {
    it("returns first N videos", async () => {
      const result = await new PlaylistQueryBuilder(http, "PLtest123").between(1, 3).execute();

      expect(result.videos.length).toBe(3);
    });

    it("returns videos in range", async () => {
      const result = await new PlaylistQueryBuilder(http, "PLtest123").between(2, 4).execute();

      expect(result.videos.length).toBe(3);
    });

    it("handles range exceeding playlist length", async () => {
      const result = await new PlaylistQueryBuilder(http, "PLtest123").between(3, 10).execute();

      expect(result.videos.length).toBe(3); // Only 3 videos from position 3
    });

    it("handles start greater than end", async () => {
      const result = await new PlaylistQueryBuilder(http, "PLtest123").between(5, 3).execute();

      expect(result.videos.length).toBe(0);
    });
  });

  describe("chaining", () => {
    it("combines filter + sort + range", async () => {
      const result = await new PlaylistQueryBuilder(http, "PLtest123")
        .filterByDuration({ min: 10 * 60 })
        .sortBy("views", "desc")
        .between(1, 2)
        .execute();

      expect(result.videos.length).toBe(2);
      expect(result.videos[0].views).toBeGreaterThanOrEqual(result.videos[1].views);
    });

    it("combines multiple filters", async () => {
      const result = await new PlaylistQueryBuilder(http, "PLtest123")
        .filterByViews({ min: 1000 })
        .filterByLikes({ min: 100 })
        .execute();

      expect(result.videos.length).toBe(4); // vid1, vid3, vid4, vid5 all pass both filters
    });
  });

  describe("execute", () => {
    it("returns empty result when no matches", async () => {
      const result = await new PlaylistQueryBuilder(http, "PLtest123")
        .filterByViews({ min: 99_999_999 })
        .execute();

      expect(result.videos.length).toBe(0);
      expect(result.videoCount).toBe(0);
      expect(result.originalCount).toBe(5);
    });

    it("returns correct videoCount and originalCount", async () => {
      const result = await new PlaylistQueryBuilder(http, "PLtest123")
        .filterByDuration({ min: 15 * 60 })
        .execute();

      expect(result.originalCount).toBe(5);
      expect(result.videoCount).toBe(3);
    });

    it("returns playlist metadata", async () => {
      const result = await new PlaylistQueryBuilder(http, "PLtest123").execute();

      expect(result.id).toBe("PLtest123");
      expect(result.title).toBe("Test Playlist");
      expect(result.description).toBe("A test playlist");
    });

    it("calculates totalDuration for filtered videos", async () => {
      const result = await new PlaylistQueryBuilder(http, "PLtest123")
        .filterByDuration({ min: 15 * 60 })
        .execute();

      // Videos with duration >= 15 minutes: 20, 15, 30 = 65 minutes = 3900 seconds
      expect(result.totalDuration).toBe(65 * 60);
    });
  });
});
