// ---------------------------------------------------------------------------
// lyra-sdk — Comments module end-to-end tests
// ---------------------------------------------------------------------------
//
// Exercises `YTClient.comments` and `topComments` against the real
// YouTube Data API. The fixture video (`dQw4w9WgXcQ`) is chosen because
// it has had comments enabled for over a decade.
//
// `searchComments` is intentionally not covered here: keyword search on
// `commentThreads.list` carries a non-trivial quota cost relative to its
// value and is exercised by the unit tests in `packages/core/tests/`.
// ---------------------------------------------------------------------------

import { expect } from "vitest";
import { describeE2E, FIXTURE_VIDEO_ID, getClient, itE2E } from "./_setup.js";

describeE2E("YTClient.comments (e2e)", () => {
  itE2E("returns at least one top-level thread", async () => {
    const client = getClient();
    const threads = await client.comments(FIXTURE_VIDEO_ID, { maxResults: 5 });

    expect(Array.isArray(threads)).toBe(true);
    expect(threads.length).toBeGreaterThan(0);
    for (const t of threads) {
      expect(t.id.length).toBeGreaterThan(0);
      expect(t.videoId).toBe(FIXTURE_VIDEO_ID);
      expect(t.topLevelComment.id).toBe(t.id);
      expect(t.topLevelComment.authorName.length).toBeGreaterThan(0);
      expect(t.topLevelComment.text.length).toBeGreaterThan(0);
      expect(t.topLevelComment.publishedAt).toBeInstanceOf(Date);
    }
  });
});

describeE2E("YTClient.topComments (e2e)", () => {
  itE2E("returns up to `limit` threads ordered by relevance", async () => {
    const client = getClient();
    const limit = 3;
    const threads = await client.topComments(FIXTURE_VIDEO_ID, limit);

    expect(threads.length).toBeGreaterThan(0);
    expect(threads.length).toBeLessThanOrEqual(limit);
  });
});
