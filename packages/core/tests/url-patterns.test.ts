import { describe, it, expect } from "vitest";
import {
  extractVideoId,
  extractPlaylistId,
  extractChannelId,
  extractUsername,
} from "../src/utils/url-patterns";

describe("extractVideoId", () => {
  it("extracts from standard watch URL", () => {
    expect(extractVideoId("https://www.youtube.com/watch?v=dQw4w9WgXcQ")).toBe(
      "dQw4w9WgXcQ",
    );
  });

  it("extracts from short URL", () => {
    expect(extractVideoId("https://youtu.be/dQw4w9WgXcQ")).toBe("dQw4w9WgXcQ");
  });

  it("extracts from embed URL", () => {
    expect(extractVideoId("https://www.youtube.com/embed/dQw4w9WgXcQ")).toBe(
      "dQw4w9WgXcQ",
    );
  });

  it("extracts from shorts URL", () => {
    expect(extractVideoId("https://www.youtube.com/shorts/dQw4w9WgXcQ")).toBe(
      "dQw4w9WgXcQ",
    );
  });

  it("returns null for non-video URL", () => {
    expect(
      extractVideoId("https://www.youtube.com/playlist?list=PLxxx"),
    ).toBeNull();
  });
});

describe("extractPlaylistId", () => {
  it("extracts from playlist URL", () => {
    expect(
      extractPlaylistId("https://www.youtube.com/playlist?list=PLtest123"),
    ).toBe("PLtest123");
  });

  it("extracts from watch URL with list param", () => {
    expect(
      extractPlaylistId("https://www.youtube.com/watch?v=abc&list=PLtest123"),
    ).toBe("PLtest123");
  });

  it("returns null when no list param", () => {
    expect(extractPlaylistId("https://www.youtube.com/watch?v=abc")).toBeNull();
  });
});

describe("extractChannelId", () => {
  it("extracts from channel URL", () => {
    expect(extractChannelId("https://www.youtube.com/channel/UCtest123")).toBe(
      "UCtest123",
    );
  });

  it("returns null for non-channel URL", () => {
    expect(extractChannelId("https://www.youtube.com/watch?v=abc")).toBeNull();
  });
});

describe("extractUsername", () => {
  it("extracts @username from URL", () => {
    expect(extractUsername("https://www.youtube.com/@MrBeast")).toBe("MrBeast");
  });

  it("returns null for non-username URL", () => {
    expect(extractUsername("https://www.youtube.com/watch?v=abc")).toBeNull();
  });
});
