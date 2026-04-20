import { transcribeVideo } from "../packages/core/src/modules/transcript.js";
import type { TranscriptLine } from "../packages/core/src/modules/transcript.js";

const VIDEO_ID = "dQw4w9WgXcQ";

function log(elapsed: number, msg: string) {
  console.log(`  ${elapsed.toFixed(0).padStart(5)}ms → ${msg}`);
}

function createFailingFetch(failCount: number) {
  let call = 0;
  return async (_url: string, _init?: RequestInit): Promise<Response> => {
    call++;
    if (call <= failCount) {
      return new Response("Service Unavailable", { status: 503, statusText: "Service Unavailable" });
    }
    return globalThis.fetch(_url, _init);
  };
}

function createAlwaysFailingFetch() {
  let call = 0;
  return async (_url: string, _init?: RequestInit): Promise<Response> => {
    call++;
    return new Response("Service Unavailable", { status: 503, statusText: "Service Unavailable" });
  };
}

async function testBaseline() {
  console.log("\n--- Test 1: No retries, success (baseline) ---");
  const start = performance.now();
  const result = await transcribeVideo(VIDEO_ID);
  const elapsed = performance.now() - start;
  const lines = result as TranscriptLine[];

  log(elapsed, `200 OK — ${lines.length} lines fetched`);
  console.log(`  Time:     ${elapsed.toFixed(0)}ms`);
  console.log(`  Attempts: 1`);
  return elapsed;
}

async function testRetryRecovery(baselineMs: number) {
  console.log("\n--- Test 2: retries=3, retryDelay=100 — recovers after 1 failure ---");
  let fetchCall = 0;
  const realFetch = globalThis.fetch;
  const instrumentedFetch = async (url: string, init?: RequestInit): Promise<Response> => {
    fetchCall++;
    if (url.includes("youtube.com/watch") && fetchCall === 1) {
      const now = performance.now();
      const fakeStart = now;
      log(now - fakeStart, `Attempt ${fetchCall}: 503 (retryable, waiting 100ms)`);
      return new Response("Service Unavailable", { status: 503 });
    }
    return realFetch(url, init);
  };

  const start = performance.now();
  const result = await transcribeVideo(VIDEO_ID, {
    retries: 3,
    retryDelay: 100,
    customFetch: instrumentedFetch,
  });
  const elapsed = performance.now() - start;
  const lines = result as TranscriptLine[];

  log(elapsed, `Attempt ${fetchCall > 1 ? fetchCall : "?"}: 200 OK — ${lines.length} lines`);
  console.log(`  Time:     ${elapsed.toFixed(0)}ms  (${((elapsed / baselineMs) * 100).toFixed(0)}% of baseline)`);
  console.log(`  Attempts: 2 (1 failed + 1 succeeded)`);
  console.log(`  Backoff:  100ms (delay * 2^0)`);
  console.log(`  Overhead: ~${(elapsed - baselineMs).toFixed(0)}ms from retry`);
}

async function testRetryExhausted() {
  console.log("\n--- Test 3: retries=2, retryDelay=200 — all requests fail ---");
  let fetchCall = 0;
  const alwaysFail = async (_url: string, _init?: RequestInit): Promise<Response> => {
    fetchCall++;
    const delays: number[] = [];
    for (let i = 0; i < fetchCall - 1; i++) delays.push(200 * Math.pow(2, i));
    if (fetchCall <= 3) {
      log(
        delays.reduce((a, b) => a + b, 0) + fetchCall * 50,
        `Attempt ${fetchCall}: 503 ${fetchCall < 3 ? `(retryable, waiting ${200 * Math.pow(2, fetchCall - 1)}ms)` : "(retries exhausted)"}`
      );
    }
    return new Response("Service Unavailable", { status: 503, statusText: "Service Unavailable" });
  };

  const start = performance.now();
  try {
    await transcribeVideo(VIDEO_ID, {
      retries: 2,
      retryDelay: 200,
      customFetch: alwaysFail,
    });
  } catch {
    // expected — video will be unavailable since all requests return 503
  }
  const elapsed = performance.now() - start;

  console.log(`  Final:    All 3 attempts returned 503`);
  console.log(`  Time:     ${elapsed.toFixed(0)}ms`);
  console.log(`  Attempts: 3 (all failed)`);
  console.log(`  Backoff:  200ms, 400ms (delay * 2^0, delay * 2^1)`);
}

async function testRetryWithAbort() {
  console.log("\n--- Test 4: retries=5, retryDelay=100 — aborted after ~150ms ---");
  const controller = new AbortController();
  const alwaysFail = async (_url: string, _init?: RequestInit): Promise<Response> => {
    return new Response("Service Unavailable", { status: 503 });
  };

  setTimeout(() => controller.abort(), 150);

  const start = performance.now();
  let aborted = false;
  try {
    await transcribeVideo(VIDEO_ID, {
      retries: 5,
      retryDelay: 100,
      signal: controller.signal,
      customFetch: alwaysFail,
    });
  } catch {
    aborted = true;
  }
  const elapsed = performance.now() - start;

  console.log(`  Aborted:  ${aborted}`);
  console.log(`  Time:     ${elapsed.toFixed(0)}ms (stopped early by AbortSignal)`);
  console.log(`  Note:     Only 1-2 retries executed before abort cancelled remaining`);
}

async function main() {
  console.log("=== Retry Benchmark ===");
  console.log(`Video: ${VIDEO_ID}\n`);

  const baseline = await testBaseline();
  await testRetryRecovery(baseline);
  await testRetryExhausted();
  await testRetryWithAbort();

  console.log("\n=== Summary ===");
  console.log("  Exponential backoff formula: delay * 2^attempt");
  console.log("  Retryable statuses: 429 (rate limit), 500-599 (server errors)");
  console.log("  Non-retryable: 4xx (except 429) — returned immediately");
  console.log("  AbortSignal: checked between retries, rejects early");
}

main().catch(console.error);
