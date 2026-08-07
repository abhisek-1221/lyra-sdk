import { describe, expect, it } from "vitest";
import { TranscriptParser } from "../src/parser/transcript-parser.js";
import type { TranscriptWithMetaMirror } from "../src/parser/transcript-mirror.js";
import { YouTubeTranscriptSourceParser } from "../src/parser/youtube/youtube-transcript-source-parser.js";
import type { YouTubeTranscriptLoader } from "../src/parser/youtube/youtube-transcript-loader.js";

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
  ],
};

describe("YouTubeTranscriptSourceParser", () => {
  it("loads a transcript then maps it via TranscriptParser", async () => {
    const loader: YouTubeTranscriptLoader = {
      async load() {
        return fixture as unknown as any;
      },
    };

    const parser = new YouTubeTranscriptSourceParser({
      loader,
      transcriptParser: new TranscriptParser(),
    });

    const doc = await parser.parse({ videoId: "abc123XYZ_-" });
    expect(doc.sourceUri).toBe("youtube:abc123XYZ_-");
    expect(doc.content).toBe("Hello\nworld");
    expect(doc.blocks.length).toBe(2);
    expect(doc.metadata).toMatchObject({ videoId: "abc123XYZ_-", title: "T" });
  });
});

