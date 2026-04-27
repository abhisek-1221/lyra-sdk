import { describe, expect, it, vi } from "vitest";
import { HttpClient } from "../src/http.js";
import { getChannel } from "../src/modules/channel.js";

const CHANNEL_ID = "UCX6OQ3DkcsbYNE6H8uQQuVA";

function channelResponse(id = CHANNEL_ID) {
  return {
    items: [
      {
        id,
        snippet: {
          title: "Test Channel",
          customUrl: "@testchannel",
          country: "US",
          thumbnails: {
            default: { url: "https://img.youtube.com/default.jpg", width: 120, height: 90 },
            medium: { url: "https://img.youtube.com/medium.jpg", width: 320, height: 180 },
            high: { url: "https://img.youtube.com/high.jpg", width: 480, height: 360 },
          },
        },
        statistics: {
          subscriberCount: "1000",
          viewCount: "2000",
          videoCount: "10",
        },
        contentDetails: {
          relatedPlaylists: { uploads: "UUuploads" },
        },
      },
    ],
  };
}

describe("channel module", () => {
  it("resolves handles through channels.list forHandle before fetching details", async () => {
    const http = new HttpClient({ apiKey: "test-key" });
    const getMock = vi
      .spyOn(http, "get")
      .mockResolvedValueOnce({ items: [{ id: CHANNEL_ID }] })
      .mockResolvedValueOnce(channelResponse());

    const channel = await getChannel(http, "@testchannel");

    expect(channel.id).toBe(CHANNEL_ID);
    expect(getMock).toHaveBeenNthCalledWith(1, "channels", {
      part: "id",
      forHandle: "@testchannel",
    });
    expect(getMock).toHaveBeenNthCalledWith(2, "channels", {
      part: "snippet,statistics,contentDetails",
      id: CHANNEL_ID,
    });
    expect(getMock).not.toHaveBeenCalledWith("search", expect.anything());
  });

  it("falls back to search when forHandle does not resolve", async () => {
    const http = new HttpClient({ apiKey: "test-key" });
    const getMock = vi
      .spyOn(http, "get")
      .mockResolvedValueOnce({ items: [] })
      .mockResolvedValueOnce({ items: [{ snippet: { channelId: CHANNEL_ID } }] })
      .mockResolvedValueOnce(channelResponse());

    const channel = await getChannel(http, "@legacyname");

    expect(channel.id).toBe(CHANNEL_ID);
    expect(getMock).toHaveBeenNthCalledWith(1, "channels", {
      part: "id",
      forHandle: "@legacyname",
    });
    expect(getMock).toHaveBeenNthCalledWith(2, "search", {
      part: "snippet",
      q: "legacyname",
      type: "channel",
      maxResults: "1",
    });
  });
});
