import { describe, expect, it, vi } from "vitest";
import { HttpClient } from "../src/http.js";
import { getVideo, getVideos } from "../src/modules/video.js";

function videoResource(id: string, channelTitle = "Snippet Channel") {
  return {
    id,
    snippet: {
      title: `Video ${id}`,
      description: `Description ${id}`,
      channelId: "UC123",
      channelTitle,
      publishedAt: "2024-01-01T00:00:00Z",
      thumbnails: {
        default: { url: "https://img.youtube.com/default.jpg", width: 120, height: 90 },
        medium: { url: "https://img.youtube.com/medium.jpg", width: 320, height: 180 },
        high: { url: "https://img.youtube.com/high.jpg", width: 480, height: 360 },
      },
    },
    statistics: {
      viewCount: "1000",
      likeCount: "100",
      commentCount: "10",
    },
    contentDetails: {
      duration: "PT3M30S",
    },
  };
}

describe("video module", () => {
  it("uses snippet.channelTitle without an extra channels.list call", async () => {
    const http = new HttpClient({ apiKey: "test-key" });
    const getMock = vi.spyOn(http, "get").mockImplementation(async (path: string) => {
      if (path === "videos") return { items: [videoResource("abc", "Direct Channel")] };
      throw new Error(`Unexpected path: ${path}`);
    });

    const video = await getVideo(http, "abc");

    expect(video.channel).toBe("Direct Channel");
    expect(getMock).toHaveBeenCalledTimes(1);
    expect(getMock).not.toHaveBeenCalledWith("channels", expect.anything());
  });

  it("batch maps channel titles from video snippets only", async () => {
    const http = new HttpClient({ apiKey: "test-key" });
    const getMock = vi.spyOn(http, "get").mockResolvedValue({
      items: [videoResource("abc", "Channel A"), videoResource("def", "Channel B")],
    });

    const videos = await getVideos(http, ["abc", "def"]);

    expect(videos.map((video) => video.channel)).toEqual(["Channel A", "Channel B"]);
    expect(getMock).toHaveBeenCalledTimes(1);
    expect(getMock).not.toHaveBeenCalledWith("channels", expect.anything());
  });
});
