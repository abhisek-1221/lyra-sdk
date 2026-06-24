// ---------------------------------------------------------------------------
// lyra-sdk — Playlist module end-to-end tests
// ---------------------------------------------------------------------------
//
// Exercises `YTClient.playlistInfo`, `playlistVideoIds`, `playlist`, and
// the `playlistQuery` builder against the real YouTube Data API.
//
// The channel's auto-generated "uploads" playlist is used as the fixture
// because it is guaranteed to exist and contain the channel's own videos
// (so we don't have to hard-code any secondary playlist id).
// ---------------------------------------------------------------------------

import { expect } from "vitest";
import { describeE2E, FIXTURE_VIDEO_ID, getClient, itE2E } from "./_setup.js";

describeE2E("YTClient.playlistInfo (e2e)", () => {
  itE2E("fetches the uploads playlist of a known channel", async () => {
    const client = getClient();
    const video = await client.video(FIXTURE_VIDEO_ID);
    const channel = await client.channel(video.channelId);

    const info = await client.playlistInfo(channel.uploadsPlaylistId);

    expect(info.id).toBe(channel.uploadsPlaylistId);
    expect(info.title.length).toBeGreaterThan(0);
  });
});

describeE2E("YTClient.playlistVideoIds (e2e)", () => {
  itE2E("returns the video ids in a channel's uploads playlist", async () => {
    const client = getClient();
    const video = await client.video(FIXTURE_VIDEO_ID);
    const channel = await client.channel(video.channelId);

    const ids = await client.playlistVideoIds(channel.uploadsPlaylistId);

    expect(ids.length).toBeGreaterThan(0);
    expect(ids).toContain(FIXTURE_VIDEO_ID);
    for (const id of ids) {
      expect(id).toMatch(/^[\w-]{11}$/);
    }
  });
});

describeE2E("YTClient.playlist (e2e)", () => {
  itE2E("returns playlist metadata plus the first page of videos", async () => {
    const client = getClient();
    const video = await client.video(FIXTURE_VIDEO_ID);
    const channel = await client.channel(video.channelId);

    const playlist = await client.playlist(channel.uploadsPlaylistId);

    expect(playlist.id).toBe(channel.uploadsPlaylistId);
    expect(playlist.title.length).toBeGreaterThan(0);
    expect(playlist.videoCount).toBeGreaterThan(0);
    expect(playlist.videos.length).toBeGreaterThan(0);
    expect(playlist.totalDuration).toBeGreaterThan(0);
    expect(playlist.totalDurationFmt).toMatch(/\d+[dhms]/);
    for (const v of playlist.videos) {
      expect(v.id).toMatch(/^[\w-]{11}$/);
      expect(v.publishedAt).toBeInstanceOf(Date);
    }
  });
});

describeE2E("YTClient.playlistQuery (e2e)", () => {
  itE2E("chains a builder — between(1, 2).execute() returns at most 2 videos", async () => {
    const client = getClient();
    const video = await client.video(FIXTURE_VIDEO_ID);
    const channel = await client.channel(video.channelId);

    const result = await client
      .playlistQuery(channel.uploadsPlaylistId)
      .between(1, 2)
      .execute();

    expect(result.videoCount).toBeLessThanOrEqual(2);
    expect(result.videos.length).toBe(result.videoCount);
    expect(result.originalCount).toBeGreaterThanOrEqual(result.videoCount);
  });
});
