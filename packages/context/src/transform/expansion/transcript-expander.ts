import type { ContextChunk } from "../../types/index.js";
import type { Expander } from "../strategies.js";

/**
 * Options for {@link TranscriptExpander}.
 */
export interface TranscriptExpanderOptions {
  /**
   * Adjacent-window size in milliseconds. The expander pulls in
   * any chunk whose `timestamp` is within this window on either
   * side of a selected chunk. Default 30 000 ms (30 seconds).
   */
  readonly windowMs?: number;
  /**
   * Optional cap on total text length (chars) added by expansion.
   * When the cap is reached, expansion stops. Default: no cap.
   */
  readonly maxAddedChars?: number;
  /**
   * The corpus to pull adjacent chunks from. The `expand` input
   * is the **selected** set; this is the full corpus. When
   * omitted, the expander uses the input as the corpus
   * (self-pool), which is the typical case for fully-materialized
   * context construction.
   */
  readonly corpus?: readonly ContextChunk[];
}

/**
 * Transcript-aware expander. For each selected chunk (the input
 * to `expand`), pulls in adjacent chunks in the same document
 * within a time window.
 *
 * Behaviour:
 *   - For each selected chunk C with timestamp T, all chunks in
 *     the corpus (default = the input) in the same document with
 *     timestamp in [T - windowMs, T + windowMs] are added to the
 *     output.
 *   - The expander dedupes by `chunkId` (an expanded chunk can
 *     only appear once even if multiple selected chunks
 *     "asked" for it).
 *   - The expander does NOT mutate the input; it returns a new
 *     array.
 *
 * When the corpus is the same as the input (the default), the
 * expander preserves all input chunks and may add additional
 * adjacent ones from the same list. When a separate corpus is
 * supplied (e.g. all chunks in the document, not just the
 * selected hits), the expander can pull in chunks the
 * application did not select.
 */
export class TranscriptExpander implements Expander {
  public readonly name = "transcript";
  private readonly windowMs: number;
  private readonly maxAddedChars: number | undefined;
  private readonly corpus: readonly ContextChunk[] | undefined;

  constructor(options: TranscriptExpanderOptions = {}) {
    const w = options.windowMs ?? 30_000;
    if (!Number.isFinite(w) || w < 0) {
      throw new Error(`TranscriptExpander: windowMs must be a non-negative number, got ${w}`);
    }
    this.windowMs = w;
    if (options.maxAddedChars !== undefined) {
      if (!Number.isInteger(options.maxAddedChars) || options.maxAddedChars < 0) {
        throw new Error(
          `TranscriptExpander: maxAddedChars must be a non-negative integer, got ${options.maxAddedChars}`,
        );
      }
      this.maxAddedChars = options.maxAddedChars;
    }
    this.corpus = options.corpus;
  }

  public expand(chunks: readonly ContextChunk[]): readonly ContextChunk[] {
    if (chunks.length === 0) return [];
    const corpus = this.corpus ?? chunks;
    if (corpus.length === 0) return chunks;
    // Index corpus by (documentId) -> chunks with timestamps.
    const pool = new Map<string, ContextChunk[]>();
    for (const c of corpus) {
      if (c.timestamp === undefined) continue;
      const key = String(c.documentId);
      const arr = pool.get(key);
      if (arr === undefined) pool.set(key, [c]);
      else arr.push(c);
    }
    const seen = new Set<string>();
    const out: ContextChunk[] = [];
    let addedChars = 0;
    // 1. Add all input chunks (the user's selected set).
    for (const c of chunks) {
      if (!seen.has(String(c.chunkId))) {
        seen.add(String(c.chunkId));
        out.push(c);
      }
    }
    // 2. Pull in adjacent chunks from the corpus.
    for (const seed of chunks) {
      const t = seed.timestamp;
      if (t === undefined) continue;
      const candidates = pool.get(String(seed.documentId));
      if (candidates === undefined) continue;
      for (const cand of candidates) {
        if (cand.timestamp === undefined) continue;
        if (Math.abs(cand.timestamp - t) > this.windowMs) continue;
        if (seen.has(String(cand.chunkId))) continue;
        if (this.maxAddedChars !== undefined && addedChars + cand.text.length > this.maxAddedChars) {
          return out;
        }
        seen.add(String(cand.chunkId));
        out.push(cand);
        addedChars += cand.text.length;
      }
    }
    return out;
  }
}
