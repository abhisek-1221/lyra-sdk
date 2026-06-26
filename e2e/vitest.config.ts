import { defineConfig } from "vitest/config";

// ---------------------------------------------------------------------------
// lyra-sdk — End-to-end vitest configuration
// ---------------------------------------------------------------------------
//
// This suite hits the real YouTube Data API / innertube endpoints and is
// gated on the `YOUTUBE_API_KEY` environment variable. Every test in
// `./_setup.ts` is built on top of `it.skipIf(!e2eEnabled)`, so the suite
// silently skips on machines without a key (forks, public CI, local
// machines). See `./README.md` for the full gating contract.
//
// The build chain (`turbo run test:e2e`) is responsible for ensuring that
// `lyra-sdk` is built before this suite runs — we import the published
// package, not the source.
// ---------------------------------------------------------------------------

export default defineConfig({
  test: {
    globals: true,
    environment: "node",
    include: ["**/*.e2e.test.ts"],
    // 30 s per case — YouTube is usually < 2 s but transcript / cold
    // playlist paths can be slower.
    testTimeout: 30_000,
    // Run sequentially to keep YouTube API quota usage predictable and
    // to avoid the occasional 429 from concurrent calls.
    pool: "forks",
    poolOptions: { forks: { singleFork: true } },
  },
});
