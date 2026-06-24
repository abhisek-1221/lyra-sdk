// ---------------------------------------------------------------------------
// lyra-sdk — Channel module end-to-end tests
// ---------------------------------------------------------------------------
//
// Exercises `YTClient.channel` and `channelVideos` against the real
// YouTube Data API.
//
// To stay self-bootstrapping the suite first looks up the channel id that
// owns `FIXTURE_VIDEO_ID` and then re-uses that for the `channelVideos` test.
// This way no secondary id is hard-coded — if YouTube ever moves the
// fixture video, only the bootstrap call needs to change.
// ---------------------------------------------------------------------------

import { expect } from "vitest";
import { describeE2E, FIXTURE_VIDEO_ID, getClient, itE2E } from "./_setup.js";

describeE2E("YTClient.channel (e2e)", () => {
  itE2E("resolves a channel from a video's owning channelId", async () => {
    const client = getClient();
    const video = await client.video(FIXTURE_VIDEO_ID);

    const channel = await client.channel(video.channelId);

    expect(channel.id).toBe(video.channelId);
    expect(channel.name.length).toBeGreaterThan(0);
    expect(channel.username.startsWith("@")).toBe(true);
    expect(channel.videoCount).toBeGreaterThan(0);
    expect(channel.uploadsPlaylistId).toMatch(/^UU[\w-]{22}$/);
    expect(channel.thumbnails.default?.url).toMatch(/^https?:\/\//);
  });

  itE2E("resolves a channel by handle (e.g. @veritasium)", async () => {
    const client = getClient();
    const channel = await client.channel("@veritasium");

    expect(channel.id).toMatch(/^UC[\w-]{22}$/);
    expect(channel.name.toLowerCase()).toContain("veritasium");
    expect(channel.subscribers).toBeGreaterThan(1_000_000);
  });
});

describeE2E("YTClient.channelVideos (e2e)", () => {
  itE2E("returns up to the requested number of recent uploads", async () => {
    const client = getClient();
    const video = await client.video(FIXTURE_VIDEO_ID);
    const limit = 3;

    const uploads = await client.channelVideos(video.channelId, { limit });

    expect(uploads.length).toBeGreaterThan(0);
    expect(uploads.length).toBeLessThanOrEqual(limit);
    for (const v of uploads) {
      expect(v.id).toMatch(/^[\w-]{11}$/);
      expect(v.title.length).toBeGreaterThan(0);
      expect(v.publishedAt).toBeInstanceOf(Date);
      expect(v.durationFmt).toMatch(/\d+:\d{2}/);
      expect(v.thumbnail).toMatch(/^https?:\/\//);
    }
  });
});
