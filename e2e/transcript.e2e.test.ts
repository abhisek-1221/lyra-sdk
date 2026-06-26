// ---------------------------------------------------------------------------
// lyra-sdk — Transcript module end-to-end tests
// ---------------------------------------------------------------------------
//
// Exercises `transcribeVideo` against the real YouTube innertube /
// `timedtext` endpoints. Unlike the other e2e files this one does not
// touch the YouTube Data API at all — it scrapes the public watch page,
// the `youtubei/v1/player` JSON endpoint, and the caption track URL.
//
// The fixture video (`dQw4w9WgXcQ`) is one of the most-transcribed videos
// on YouTube and has had English captions enabled since 2009.
// ---------------------------------------------------------------------------

import { transcribeVideo } from "lyra-sdk/transcript";
import { expect } from "vitest";
import { describeE2E, FIXTURE_VIDEO_ID, itE2E } from "./_setup.js";

describeE2E("transcribeVideo (e2e)", () => {
  itE2E("returns a non-empty list of transcript lines in English", async () => {
    const lines = await transcribeVideo(FIXTURE_VIDEO_ID);

    expect(lines.length).toBeGreaterThan(10);
    for (const line of lines) {
      expect(typeof line.text).toBe("string");
      expect(line.text.length).toBeGreaterThan(0);
      expect(line.duration).toBeGreaterThan(0);
      expect(line.offset).toBeGreaterThanOrEqual(0);
      expect(line.lang).toBe("en");
    }
  });

  itE2E("returns metadata when includeMeta is true", async () => {
    const result = await transcribeVideo(FIXTURE_VIDEO_ID, { includeMeta: true });

    expect(result.meta.videoId).toBe(FIXTURE_VIDEO_ID);
    expect(result.meta.title.length).toBeGreaterThan(0);
    expect(result.meta.channelId).toMatch(/^UC[\w-]{22}$/);
    expect(result.lines.length).toBeGreaterThan(10);
  });

  itE2E("honours a custom language when one is available", async () => {
    // `en` is always available for the fixture video; this exercises the
    // explicit `lang` option without depending on a second language being
    // present in the caption track list.
    const lines = await transcribeVideo(FIXTURE_VIDEO_ID, { lang: "en" });

    expect(lines.length).toBeGreaterThan(0);
    for (const line of lines) {
      expect(line.lang).toBe("en");
    }
  });
});
