import { describe, expect, it } from "vitest";
import { formatTimestamp } from "../../src/formatter/index.js";

describe("formatTimestamp", () => {
  it("formats zero as 00:00", () => {
    expect(formatTimestamp(0)).toBe("00:00");
  });

  it("formats sub-minute durations as MM:SS", () => {
    expect(formatTimestamp(5)).toBe("00:05");
    expect(formatTimestamp(59)).toBe("00:59");
  });

  it("formats minute durations as MM:SS", () => {
    expect(formatTimestamp(60)).toBe("01:00");
    expect(formatTimestamp(75)).toBe("01:15");
  });

  it("formats hour durations as HH:MM:SS", () => {
    expect(formatTimestamp(3600)).toBe("01:00:00");
    expect(formatTimestamp(3725)).toBe("01:02:05");
  });

  it("clamps negative and non-finite values to 00:00", () => {
    expect(formatTimestamp(-1)).toBe("00:00");
    expect(formatTimestamp(NaN)).toBe("00:00");
    expect(formatTimestamp(Infinity)).toBe("00:00");
  });

  it("rounds sub-second values to the nearest integer", () => {
    expect(formatTimestamp(59.4)).toBe("00:59");
    expect(formatTimestamp(59.6)).toBe("01:00");
  });
});
