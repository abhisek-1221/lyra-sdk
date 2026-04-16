import { describe, it, expect } from "vitest";
import {
  parseDuration,
  formatDuration,
  formatDurationClock,
} from "../src/utils/duration";

describe("parseDuration", () => {
  it("parses hours, minutes and seconds", () => {
    expect(parseDuration("PT1H23M45S")).toBe(5025);
  });

  it("parses minutes and seconds only", () => {
    expect(parseDuration("PT10M30S")).toBe(630);
  });

  it("parses seconds only", () => {
    expect(parseDuration("PT45S")).toBe(45);
  });

  it("parses hours only", () => {
    expect(parseDuration("PT2H")).toBe(7200);
  });

  it("returns 0 for empty/invalid input", () => {
    expect(parseDuration("")).toBe(0);
    expect(parseDuration("not-a-duration")).toBe(0);
  });
});

describe("formatDuration", () => {
  it("formats seconds only", () => {
    expect(formatDuration(45)).toBe("45s");
  });

  it("formats minutes and seconds", () => {
    expect(formatDuration(90)).toBe("1m 30s");
  });

  it("formats hours, minutes, seconds", () => {
    expect(formatDuration(3661)).toBe("1h 1m 1s");
  });

  it("formats days", () => {
    expect(formatDuration(90061)).toBe("1d 1h 1m 1s");
  });

  it("omits zero-value middle components", () => {
    expect(formatDuration(3600)).toBe("1h");
  });

  it("shows 0s for zero input", () => {
    expect(formatDuration(0)).toBe("0s");
  });
});

describe("formatDurationClock", () => {
  it("formats without hours", () => {
    expect(formatDurationClock(90)).toBe("1:30");
  });

  it("formats with hours", () => {
    expect(formatDurationClock(3661)).toBe("1:01:01");
  });

  it("pads seconds", () => {
    expect(formatDurationClock(5)).toBe("0:05");
  });
});
