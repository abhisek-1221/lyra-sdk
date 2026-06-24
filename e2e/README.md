# lyra-sdk — End-to-end tests

This directory contains tests that hit the real YouTube Data API and
innertube endpoints. They live at the root of the monorepo (in
`@repo/e2e`) so that they exercise the **built** `lyra-sdk` package
exactly the way a real consumer would — not the source.

## What is covered

| File | Module exercised | Quota units per run |
|---|---|---|
| `video.e2e.test.ts` | `video`, `videos`, `videoTitle`, `videoTitles` | ~5 |
| `channel.e2e.test.ts` | `channel`, `channelVideos` | ~4 |
| `playlist.e2e.test.ts` | `playlistInfo`, `playlistVideoIds`, `playlist`, `playlistQuery` | ~6 |
| `comments.e2e.test.ts` | `comments`, `topComments` | ~3 |
| `i18n.e2e.test.ts` | `regions`, `languages` | ~2 |
| `transcript.e2e.test.ts` | `transcribeVideo` | 0 (no Data API) |

`searchComments` is intentionally not covered at this layer — keyword
search on `commentThreads.list` carries a non-trivial quota cost and is
exercised by the unit tests under `packages/core/tests/`.

A full run costs roughly **19 quota units** out of the daily 10,000
allotment. The transcript module is excluded from quota cost — it talks
to the public innertube + `timedtext` endpoints, not the Data API.

## How it is gated

Every test in this directory imports from [`_setup.ts`](./_setup.ts),
which:

1. Reads the `YOUTUBE_API_KEY` environment variable.
2. If the variable is missing, the suite reports each test as **skipped**
   (not failed) — so the test pipeline stays green on forks, public CI,
   and developer machines that don't have a key.
3. If the variable is present, builds a single shared `YTClient` and
   reuses it across cases to keep auth setup cheap.

To run locally:

```bash
export YOUTUBE_API_KEY=AIza...
npm run build
npm run test:e2e
```

## How the suite bootstraps

The only hard-coded resource in the entire suite is
[`FIXTURE_VIDEO_ID`](./_setup.ts) (`dQw4w9WgXcQ`). The owning channel,
the channel's `uploadsPlaylistId`, and the comments corpus are all
discovered from that one id. This keeps the suite robust to YouTube
moves: if a single secondary resource goes away, the bootstrap call
will need updating, not every test.

## When it runs in CI

The e2e workflow is defined in
[`../.github/workflows/e2e.yml`](../.github/workflows/e2e.yml). It runs:

- **Nightly** at 06:00 UTC — picks up upstream API drift within 24h.
- **On demand** via the `workflow_dispatch` trigger in the Actions UI.

It does **not** run on push or pull request. The secret
`YOUTUBE_API_KEY` must be configured in repository settings for the
workflow to actually exercise the suite — without it, every test is
silently skipped (same behaviour as locally).

The workflow's `npm run test:e2e` triggers a turbo task that depends on
`^build`, so `lyra-sdk` is rebuilt before the suite runs. That keeps
this layer honest: it tests the published artifact, not the source.

## Conventions for new e2e cases

When adding a new test file:

- **Filename**: `*.e2e.test.ts` so vitest picks it up under the
  `e2e` include glob.
- **Bootstrapping**: prefer looking up the resource you need from
  `FIXTURE_VIDEO_ID` (e.g. `video → channel → uploadsPlaylistId`)
  rather than hard-coding a new id.
- **Assertions**: keep them lenient on the *count* of returned data
  (YouTube's data is fluid) but strict on *shape* (ids, types, regex
  patterns on URLs).
- **No mocks**: this directory should never `vi.spyOn(globalThis, "fetch")`.
  Use `packages/core/tests/` for that.
