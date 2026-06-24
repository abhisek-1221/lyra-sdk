// ---------------------------------------------------------------------------
// lyra-sdk — Shared setup for end-to-end test files
// ---------------------------------------------------------------------------
//
// Every file in `*.e2e.test.ts` imports from this module so that:
//   • the suite auto-skips when `YOUTUBE_API_KEY` is missing (no flake on
//     forks / public CI),
//   • test cases get a sane per-call timeout (YouTube is occasionally slow),
//   • a single `client` is reused across all files in a run.
//
// If the env var is absent the file is a no-op and the suite is reported as
// skipped, which keeps the green check honest on machines without a key.
// ---------------------------------------------------------------------------

import { yt } from "lyra-sdk";
import { describe, it } from "vitest";

/**
 * Name of the environment variable that gates the e2e suite.
 * Matches the convention used in `scripts/` and `apps/docs/`.
 */
export const API_KEY_ENV = "YOUTUBE_API_KEY" as const;

/**
 * Per-test timeout in milliseconds.
 * YouTube's data API is normally < 2 s, but cold paths (playlists,
 * transcripts) can take longer. 30 s is generous without being silly.
 */
export const E2E_TIMEOUT_MS = 30_000;

/**
 * The well-known "Rick Astley — Never Gonna Give You Up" video.
 * Public, stable for over a decade, and the single fixture every test in
 * the suite bootstraps from. The channel, playlist, and comments are all
 * discovered from this one ID so the suite has zero hard-coded secondary
 * resources (which could rot if YouTube ever takes one down).
 */
export const FIXTURE_VIDEO_ID = "dQw4w9WgXcQ" as const;

/**
 * Returns the API key if present, otherwise `null`.
 */
export function getApiKey(): string | null {
  return process.env[API_KEY_ENV]?.trim() || null;
}

/**
 * True iff the e2e suite should actually run.
 * `it.skipIf(!e2eEnabled)` / `describe.skipIf(!e2eEnabled)` calls should
 * be used to gate every test in this directory.
 */
export const e2eEnabled: boolean = getApiKey() !== null;

/**
 * Pre-built `it` and `describe` that auto-skip when no API key is set
 * AND apply a 30 s per-test timeout. Use these in every e2e test file:
 *
 * ```ts
 * import { itE2E, describeE2E } from "./_setup.js";
 *
 * describeE2E("YTClient.video (e2e)", () => {
 *   itE2E("returns full metadata", async () => { ... });
 * });
 * ```
 */
export const itE2E = it.skipIf(!e2eEnabled).extend({ timeout: E2E_TIMEOUT_MS });
export const describeE2E = describe.skipIf(!e2eEnabled);

/**
 * A single shared `YTClient` instance for the whole e2e run.
 * Built lazily so importing this file never throws on keyless machines.
 */
let _client: ReturnType<typeof yt> | null = null;

export function getClient() {
  if (!_client) {
    const key = getApiKey();
    if (!key) {
      throw new Error(
        `${API_KEY_ENV} is not set — e2e tests are gated on this variable. ` +
          "Set it in your environment or `.env` to run the suite."
      );
    }
    _client = yt(key);
  }
  return _client;
}
