import { describe, expect, it } from "vitest";
import { TranscriptParser } from "../src/parser/transcript-parser.js";
import type { TranscriptWithMetaMirror } from "../src/parser/transcript-mirror.js";

const fixture: TranscriptWithMetaMirror = {
  meta: {
    videoId: "abc123XYZ_-",
    title: "T",
    author: "A",
    channelId: "UC",
    lengthSeconds: 100,
    viewCount: 0,
    description: "",
    keywords: [],
    thumbnails: [],
    isLiveContent: false,
  },
  lines: [
    { text: "Hello", duration: 1, offset: 0, lang: "en" },
    { text: "world", duration: 1, offset: 1, lang: "en" },
    { text: "again", duration: 1, offset: 2, lang: "en" },
  ],
};

describe("TranscriptParser", () => {
  it("joins lines with newlines into content", () => {
    const d = new TranscriptParser().parse(fixture);
    expect(d.content).toBe("Hello\nworld\nagain");
  });

  it("mirrors each line as a block with line metadata", () => {
    const d = new TranscriptParser().parse(fixture);
    expect(d.blocks.length).toBe(3);
    expect(d.blocks[0]?.text).toBe("Hello");
    expect(d.blocks[0]?.metadata).toMatchObject({
      offset: 0,
      duration: 1,
      lang: "en",
      lineIndex: 0,
      contentStart: 0,
      contentEnd: 5,
    });
    expect(d.blocks[1]?.metadata).toMatchObject({ contentStart: 6, contentEnd: 11 });
    expect(d.blocks[2]?.metadata).toMatchObject({ lineIndex: 2, contentStart: 12, contentEnd: 17 });
    expect(d.content.length).toBe(17);
  });

  it("uses the videoId as the documentId and sourceUri", () => {
    const d = new TranscriptParser().parse(fixture);
    expect(d.id).toBe("abc123XYZ_-");
    expect(d.sourceUri).toBe("youtube:abc123XYZ_-");
  });

  it("carries the video metadata", () => {
    const d = new TranscriptParser().parse(fixture);
    expect(d.metadata).toMatchObject({
      videoId: "abc123XYZ_-",
      title: "T",
      author: "A",
      url: "https://www.youtube.com/watch?v=abc123XYZ_-",
    });
  });

  it("handles an empty transcript gracefully", () => {
    const d = new TranscriptParser().parse({ ...fixture, lines: [] });
    expect(d.content).toBe("");
    expect(d.blocks).toEqual([]);
  });
});
