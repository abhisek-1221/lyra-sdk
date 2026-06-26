import type { ContextChunk } from "../../types/index.js";
import type { ContextOrdering } from "../strategies.js";

/**
 * Transcript-first ordering. The default for
 * `DefaultContextBuilder` because Lyra's primary corpus is
 * transcripts.
 *
 * Algorithm:
 *   1. Split into transcript chunks (`timestamp` present) and
 *      non-transcript chunks.
 *   2. Order the transcript group by `timestamp` ascending.
 *   3. Order the non-transcript group by score descending.
 *   4. Concatenate: transcripts first, then non-transcripts.
 *
 * Pure-text applications pass `ScoreOrdering` (or any other
 * strategy) explicitly. The builder does not auto-select.
 */
export class TranscriptOrdering implements ContextOrdering {
  public readonly name = "transcript";

  public order(chunks: readonly ContextChunk[]): readonly ContextChunk[] {
    const transcripts: ContextChunk[] = [];
    const nonTranscripts: ContextChunk[] = [];
    for (const c of chunks) {
      if (c.timestamp !== undefined) {
        transcripts.push(c);
      } else {
        nonTranscripts.push(c);
      }
    }
    transcripts.sort((a, b) => {
      const ta = a.timestamp ?? Number.POSITIVE_INFINITY;
      const tb = b.timestamp ?? Number.POSITIVE_INFINITY;
      if (ta !== tb) return ta - tb;
      return String(a.chunkId).localeCompare(String(b.chunkId));
    });
    nonTranscripts.sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      return String(a.chunkId).localeCompare(String(b.chunkId));
    });
    return [...transcripts, ...nonTranscripts];
  }
}
