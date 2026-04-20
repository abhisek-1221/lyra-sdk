import { rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { CacheStore, TranscriptLine } from "../packages/core/src/modules/transcript.js";
import {
  FsCache,
  InMemoryCache,
  transcribeVideo,
} from "../packages/core/src/modules/transcript.js";

const VIDEO_ID = "dQw4w9WgXcQ";
const RUNS = 3;

function _hr(start: number): string {
  return `${(performance.now() - start).toFixed(0)}ms`;
}

function avg(values: number[], decimals: number = 0): string {
  if (values.length === 0) return "0ms";
  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  return `${mean.toFixed(decimals)}ms`;
}

function speedup(base: number, improved: number): string {
  if (improved === 0) return "inf";
  return `${(base / improved).toFixed(1)}x`;
}

function countHttpCalls(lines: TranscriptLine[]): string {
  return Array.isArray(lines) && lines.length > 0 ? "3 HTTP requests" : "0 HTTP requests";
}

async function runBench(
  label: string,
  videoId: string,
  cache?: CacheStore,
  _cacheLabel?: string
): Promise<{ times: number[]; hitTimes: number[]; missTimes: number[] }> {
  const times: number[] = [];
  const hitTimes: number[] = [];
  const missTimes: number[] = [];

  console.log(`\n--- ${label} ---`);

  for (let i = 0; i < RUNS; i++) {
    const start = performance.now();
    const result = await transcribeVideo(videoId, { cache });
    const elapsed = performance.now() - start;
    times.push(elapsed);

    const lines = result as TranscriptLine[];
    const isHit = elapsed < 50;

    if (isHit) {
      hitTimes.push(elapsed);
      console.log(`  Run ${i + 1}: ${elapsed.toFixed(2)}ms  (cache HIT — ${lines.length} lines from cache)`);
    } else {
      missTimes.push(elapsed);
      console.log(`  Run ${i + 1}: ${elapsed.toFixed(0)}ms  (cold — ${countHttpCalls(lines)})`);
    }
  }

  console.log(`  Avg:   ${avg(times, 0)}  |  Cold: ${avg(missTimes, 0)}  |  Hit: ${avg(hitTimes, 2)}`);
  if (cache && "size" in cache) {
    console.log(`  Cache entries: ${(cache as InMemoryCache).size}`);
  }

  return { times, hitTimes, missTimes };
}

async function main() {
  console.log(`=== Cache Benchmark: ${VIDEO_ID} ===`);
  console.log(`Runs per strategy: ${RUNS}\n`);

  const noCacheResult = await runBench("No Cache", VIDEO_ID);
  const memCache = new InMemoryCache();
  const memResult = await runBench("InMemoryCache", VIDEO_ID, memCache);

  const fsDir = join(tmpdir(), `lyra-bench-fscache-${Date.now()}`);
  const fsCache = new FsCache(fsDir);
  const fsResult = await runBench("FsCache", VIDEO_ID, fsCache);

  rmSync(fsDir, { recursive: true, force: true });

  const noCacheAvg = noCacheResult.times.reduce((a, b) => a + b, 0) / noCacheResult.times.length;
  const memHitAvg =
    memResult.hitTimes.length > 0
      ? memResult.hitTimes.reduce((a, b) => a + b, 0) / memResult.hitTimes.length
      : 0;
  const fsHitAvg =
    fsResult.hitTimes.length > 0
      ? fsResult.hitTimes.reduce((a, b) => a + b, 0) / fsResult.hitTimes.length
      : 0;

  console.log("\n=== Summary ===");
  console.log(`  No Cache avg:        ${avg(noCacheResult.times, 0)}`);
  console.log(
    `  InMemoryCache avg:   ${avg(memResult.times, 0)}  (${speedup(noCacheAvg, memResult.times.reduce((a, b) => a + b, 0) / memResult.times.length)} faster overall)`
  );
  console.log(
    `  FsCache avg:         ${avg(fsResult.times, 0)}  (${speedup(noCacheAvg, fsResult.times.reduce((a, b) => a + b, 0) / fsResult.times.length)} faster overall)`
  );
  if (memHitAvg > 0) {
    console.log(`  InMemoryCache hit:   ~${memHitAvg.toFixed(2)}ms  (${speedup(noCacheAvg, memHitAvg)} faster than no-cache)`);
  }
  if (fsHitAvg > 0) {
    console.log(`  FsCache hit:         ~${fsHitAvg.toFixed(2)}ms  (${speedup(noCacheAvg, fsHitAvg)} faster than no-cache)`);
  }
}

main().catch(console.error);
