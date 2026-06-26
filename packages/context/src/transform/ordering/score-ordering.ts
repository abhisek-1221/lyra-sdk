import type { ContextChunk } from "../../types/index.js";
import type { ContextOrdering } from "../strategies.js";

/**
 * Order chunks by score descending. Pure-text corpora; also the
 * fallback ordering when no transcript signal is present.
 */
export class ScoreOrdering implements ContextOrdering {
  public readonly name = "score";

  public order(chunks: readonly ContextChunk[]): readonly ContextChunk[] {
    return [...chunks].sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      return String(a.chunkId).localeCompare(String(b.chunkId));
    });
  }
}
