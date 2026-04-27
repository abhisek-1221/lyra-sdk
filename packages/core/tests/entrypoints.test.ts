import {
  formatDate,
  formatDuration,
  formatDurationClock,
  formatNumber,
  parseDuration,
  relativeTime,
} from "../src/fmt.js";
import {
  extractPlaylistId,
  extractUsername,
  extractVideoId,
  isPlaylistURL,
  isVideoURL,
  parseURL,
} from "../src/url.js";

describe("url entrypoint", () => {
  it("exports URL parsers and extractors used by docs", () => {
    expect(parseURL("https://youtu.be/dQw4w9WgXcQ")).toMatchObject({
      isValid: true,
      type: "video",
      videoId: "dQw4w9WgXcQ",
    });
    expect(isVideoURL("https://youtu.be/dQw4w9WgXcQ")).toBe(true);
    expect(isPlaylistURL("https://www.youtube.com/playlist?list=PLtest123")).toBe(true);
    expect(extractVideoId("https://www.youtube.com/watch?v=dQw4w9WgXcQ")).toBe("dQw4w9WgXcQ");
    expect(extractPlaylistId("https://www.youtube.com/playlist?list=PLtest123")).toBe("PLtest123");
    expect(extractUsername("https://www.youtube.com/@MrBeast")).toBe("MrBeast");
  });
});

describe("fmt entrypoint", () => {
  it("exports number, date, and duration formatters used by docs", () => {
    expect(formatNumber(1_763_613_349)).toBe("1.8B");
    expect(parseDuration("PT1H2M3S")).toBe(3723);
    expect(formatDurationClock(214)).toBe("3:34");
    expect(formatDuration(90061)).toBe("1d 1h 1m 1s");
    expect(formatDate("2024-01-01T00:00:00Z")).toContain("2024");
    expect(relativeTime(new Date())).toMatch(/ago|now/);
  });
});
