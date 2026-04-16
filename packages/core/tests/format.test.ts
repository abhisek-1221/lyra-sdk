import { describe, expect, it } from "vitest";
import { formatDate, formatNumber, relativeTime } from "../src/utils/format";

describe("formatNumber", () => {
  it("compacts millions", () => {
    const result = formatNumber(1_500_000);
    expect(result).toMatch(/1\.5M/);
  });

  it("compacts thousands", () => {
    const result = formatNumber(12_300);
    expect(result).toMatch(/12\.3K|12K/);
  });

  it("small numbers stay as-is", () => {
    expect(formatNumber(42)).toBe("42");
  });
});

describe("formatDate", () => {
  it("formats ISO string to long date", () => {
    const result = formatDate("2024-01-15T12:00:00Z");
    expect(result).toBe("January 15, 2024");
  });
});

describe("relativeTime", () => {
  it("returns 'X days ago' for past dates", () => {
    const twoDaysAgo = new Date(Date.now() - 2 * 86_400_000);
    expect(relativeTime(twoDaysAgo)).toBe("2 days ago");
  });

  it("returns 'X hours ago' for recent dates", () => {
    const threeHoursAgo = new Date(Date.now() - 3 * 3_600_000);
    expect(relativeTime(threeHoursAgo)).toBe("3 hours ago");
  });

  it("returns singular form", () => {
    const oneDayAgo = new Date(Date.now() - 86_400_000);
    expect(relativeTime(oneDayAgo)).toBe("1 day ago");
  });
});
