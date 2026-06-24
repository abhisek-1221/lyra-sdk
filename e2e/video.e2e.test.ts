// ---------------------------------------------------------------------------
// lyra-sdk — Video module end-to-end tests
// ---------------------------------------------------------------------------
//
// Exercises `YTClient.video`, `videos`, `videoTitle`, and `videoTitles`
// against the real YouTube Data API.
//
// All tests are skipped automatically when `YOUTUBE_API_KEY` is not set.
// See `./_setup.ts` for the gating contract.
// ---------------------------------------------------------------------------

import { NotFoundError } from "lyra-sdk";
import { expect } from "vitest";
import { describeE2E, FIXTURE_VIDEO_ID, getClient, itE2E } from "./_setup.js";

describeE2E("YTClient.video (e2e)", () => {
  itE2E("returns full metadata for a known public video", async () => {
    const client = getClient();
    const video = await client.video(FIXTURE_VIDEO_ID);

    expect(video.id).toBe(FIXTURE_VIDEO_ID);
    expect(video.title.length).toBeGreaterThan(0);
    expect(video.channelId).toMatch(/^UC[\w-]{22}$/);
    expect(video.channel.length).toBeGreaterThan(0);
    expect(video.publishedAt).toBeInstanceOf(Date);
    expect(Number.isFinite(video.publishedAt.getTime())).toBe(true);
    expect(video.duration).toBeGreaterThan(0);
    expect(video.durationFmt).toMatch(/\d+:\d{2}/);
    expect(video.thumbnails.high?.url).toMatch(/^https?:\/\//);
  });

  itE2E("accepts a full URL as well as a bare id", async () => {
    const client = getClient();
    const byId = await client.video(FIXTURE_VIDEO_ID);
    const byUrl = await client.video(`https://youtu.be/${FIXTURE_VIDEO_ID}`);

    expect(byUrl.id).toBe(byId.id);
    expect(byUrl.title).toBe(byId.title);
  });

  itE2E("rejects with NotFoundError for a syntactically valid but unknown id", async () => {
    const client = getClient();
    await expect(client.video("xxxxxxxxxxx")).rejects.toBeInstanceOf(NotFoundError);
  });
});

describeE2E("YTClient.videos (e2e)", () => {
  itE2E("returns one entry per requested id, preserving order", async () => {
    const client = getClient();
    const ids = [FIXTURE_VIDEO_ID, FIXTURE_VIDEO_ID];
    const videos = await client.videos(ids);

    expect(videos).toHaveLength(2);
    expect(videos.every((v) => v.id === FIXTURE_VIDEO_ID)).toBe(true);
  });
});

describeE2E("YTClient.videoTitle (e2e)", () => {
  itE2E("returns just the title string — cheap 1-quota-unit call", async () => {
    const client = getClient();
    const title = await client.videoTitle(FIXTURE_VIDEO_ID);

    expect(typeof title).toBe("string");
    expect(title.length).toBeGreaterThan(0);
  });
});

describeE2E("YTClient.videoTitles (e2e)", () => {
  itE2E("returns a map of id → title for the batch", async () => {
    const client = getClient();
    const map = await client.videoTitles([FIXTURE_VIDEO_ID]);

    expect(Object.keys(map)).toEqual([FIXTURE_VIDEO_ID]);
    expect(map[FIXTURE_VIDEO_ID].length).toBeGreaterThan(0);
  });
});
