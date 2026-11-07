import { describe, expect, it } from "vitest";
import {
  isYouTubeInput,
  isYouTubeUrlString,
  toYouTubeInput,
} from "../src/parser/youtube/youtube-input.js";

describe("isYouTubeUrlString", () => {
  it("accepts known YouTube hosts", () => {
    expect(isYouTubeUrlString("https://youtu.be/dQw4w9WgXcQ")).toBe(true);
    expect(isYouTubeUrlString("https://www.youtube.com/watch?v=dQw4w9WgXcQ")).toBe(true);
    expect(isYouTubeUrlString("https://youtube-nocookie.com/embed/dQw4w9WgXcQ")).toBe(true);
    expect(isYouTubeUrlString("youtu.be/dQw4w9WgXcQ")).toBe(true);
  });

  it("rejects non-YouTube strings", () => {
    expect(isYouTubeUrlString("what is RAG?")).toBe(false);
    expect(isYouTubeUrlString("https://example.com/watch?v=1")).toBe(false);
    expect(isYouTubeUrlString("")).toBe(false);
    expect(isYouTubeUrlString(42)).toBe(false);
  });
});

describe("isYouTubeInput", () => {
  it("accepts URL strings and {url}|{videoId}", () => {
    expect(isYouTubeInput("https://youtu.be/abc")).toBe(true);
    expect(isYouTubeInput({ url: "https://youtu.be/abc" })).toBe(true);
    expect(isYouTubeInput({ videoId: "abc123XYZ_-" })).toBe(true);
  });

  it("rejects transcript objects and mixed shapes", () => {
    expect(isYouTubeInput({ meta: {}, lines: [] })).toBe(false);
    expect(isYouTubeInput({ url: "https://youtu.be/a", videoId: "a" })).toBe(false);
    expect(isYouTubeInput({ url: "" })).toBe(false);
    expect(isYouTubeInput(null)).toBe(false);
  });

  it("rejects a non-YouTube { url } so other parsers still receive it", () => {
    expect(isYouTubeInput({ url: "https://example.com/article" })).toBe(false);
  });
});

describe("toYouTubeInput", () => {
  it("wraps URL strings and normalizes objects", () => {
    expect(toYouTubeInput("  https://youtu.be/abc  ")).toEqual({ url: "https://youtu.be/abc" });
    expect(toYouTubeInput({ videoId: "  id  " })).toEqual({ videoId: "id" });
  });
});
