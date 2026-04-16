import { describe, expect, it } from "vitest";
import { YTError, yt } from "../src/index";

describe("yt() factory", () => {
  it("throws when API key is missing", () => {
    expect(() => yt("")).toThrow("API key is required");
  });

  it("creates a client with a valid key", () => {
    const client = yt("test-key");
    expect(client).toBeDefined();
    expect(typeof client.video).toBe("function");
    expect(typeof client.playlist).toBe("function");
    expect(typeof client.channel).toBe("function");
  });

  it("exposes url utilities without API calls", () => {
    const client = yt("test-key");

    const parsed = client.url.parse("https://youtu.be/dQw4w9WgXcQ");
    expect(parsed.isValid).toBe(true);
    expect(parsed.videoId).toBe("dQw4w9WgXcQ");
  });

  it("url.isVideo works correctly", () => {
    const client = yt("test-key");
    expect(client.url.isVideo("https://youtu.be/abc")).toBe(true);
    expect(client.url.isVideo("https://youtube.com/playlist?list=PLxxx")).toBe(false);
  });

  it("url.isPlaylist works correctly", () => {
    const client = yt("test-key");
    expect(client.url.isPlaylist("https://youtube.com/playlist?list=PLxxx")).toBe(true);
    expect(client.url.isPlaylist("https://youtu.be/abc")).toBe(false);
  });
});

describe("error hierarchy", () => {
  it("all custom errors extend YTError", async () => {
    const { NotFoundError, QuotaError, InvalidURLError, AuthError } = await import("../src/errors");

    expect(new NotFoundError("Video", "abc")).toBeInstanceOf(YTError);
    expect(new QuotaError()).toBeInstanceOf(YTError);
    expect(new InvalidURLError("bad")).toBeInstanceOf(YTError);
    expect(new AuthError()).toBeInstanceOf(YTError);
  });
});
