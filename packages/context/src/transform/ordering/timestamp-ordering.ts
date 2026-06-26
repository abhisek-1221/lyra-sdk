import type { ContextChunk } from "../../types/index.js";
import type { ContextOrdering } from "../strategies.js";

/**
 * Order chunks by `timestamp` ascending. Transcripts and
 * meetings: chunks read chronologically. Chunks without a
 * timestamp fall to the end, in input order.
 */
export class TimestampOrdering implements ContextOrdering {
  public readonly name = "timestamp";

  public order(chunks: readonly ContextChunk[]): readonly ContextChunk[] {
    return [...chunks].sort((a, b) => {
      const ta = a.timestamp ?? Number.POSITIVE_INFINITY;
      const tb = b.timestamp ?? Number.POSITIVE_INFINITY;
      if (ta !== tb) return ta - tb;
      return String(a.chunkId).localeCompare(String(b.chunkId));
    });
  }
}
