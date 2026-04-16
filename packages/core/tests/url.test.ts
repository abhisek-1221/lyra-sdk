import { describe, expect, it } from "vitest";
import { isPlaylistURL, isVideoURL, parseURL } from "../src/modules/url";

describe("parseURL", () => {
  it("parses standard video URL", () => {
    const result = parseURL("https://www.youtube.com/watch?v=dQw4w9WgXcQ");
    expect(result).toEqual({
      isValid: true,
      type: "video",
      videoId: "dQw4w9WgXcQ",
      playlistId: undefined,
    });
  });

  it("parses short URL", () => {
    const result = parseURL("https://youtu.be/dQw4w9WgXcQ");
    expect(result).toEqual({
      isValid: true,
      type: "video",
      videoId: "dQw4w9WgXcQ",
      playlistId: undefined,
    });
  });

  it("parses embed URL", () => {
    const result = parseURL("https://www.youtube.com/embed/dQw4w9WgXcQ");
    expect(result).toEqual({
      isValid: true,
      type: "video",
      videoId: "dQw4w9WgXcQ",
      playlistId: undefined,
    });
  });

  it("parses video URL with playlist ID", () => {
    const result = parseURL("https://www.youtube.com/watch?v=dQw4w9WgXcQ&list=PLrAXtmErZgOei");
    expect(result.isValid).toBe(true);
    expect(result.type).toBe("video");
    expect(result.videoId).toBe("dQw4w9WgXcQ");
    expect(result.playlistId).toBe("PLrAXtmErZgOei");
  });

  it("parses pure playlist URL", () => {
    const result = parseURL(
      "https://www.youtube.com/playlist?list=PLrAXtmErZgOeiKm4sgNOknGvNjby9efdf"
    );
    expect(result).toEqual({
      isValid: true,
      type: "playlist",
      playlistId: "PLrAXtmErZgOeiKm4sgNOknGvNjby9efdf",
    });
  });

  it("parses channel URL", () => {
    const result = parseURL("https://www.youtube.com/channel/UCX6OQ3DkcsbYNE6H8uQQuVA");
    expect(result.isValid).toBe(true);
    expect(result.type).toBe("channel");
    expect(result.channelId).toBe("UCX6OQ3DkcsbYNE6H8uQQuVA");
  });

  it("rejects non-YouTube URLs", () => {
    const result = parseURL("https://google.com/watch?v=abc");
    expect(result.isValid).toBe(false);
    expect(result.type).toBe("invalid");
    expect(result.error).toContain("YouTube");
  });

  it("rejects empty input", () => {
    const result = parseURL("");
    expect(result.isValid).toBe(false);
  });

  it("rejects malformed URLs", () => {
    const result = parseURL("not-a-url");
    expect(result.isValid).toBe(false);
    expect(result.error).toContain("Invalid URL");
  });

  it("handles mobile URLs", () => {
    const result = parseURL("https://m.youtube.com/watch?v=dQw4w9WgXcQ");
    expect(result.isValid).toBe(true);
    expect(result.videoId).toBe("dQw4w9WgXcQ");
  });
});

describe("isVideoURL", () => {
  it("returns true for video URLs", () => {
    expect(isVideoURL("https://youtu.be/dQw4w9WgXcQ")).toBe(true);
  });

  it("returns false for playlist URLs", () => {
    expect(isVideoURL("https://www.youtube.com/playlist?list=PLxxx")).toBe(false);
  });
});

describe("isPlaylistURL", () => {
  it("returns true for playlist URLs", () => {
    expect(isPlaylistURL("https://www.youtube.com/playlist?list=PLxxx")).toBe(true);
  });

  it("returns false for video URLs", () => {
    expect(isPlaylistURL("https://youtu.be/dQw4w9WgXcQ")).toBe(false);
  });
});
