import type { DocumentId } from "@lyra-sdk/kernel";
import type { Chunk } from "@lyra-sdk/storage";
import type { ContextChunk } from "../../types/index.js";
import type { ExpandContext, Expander } from "../strategies.js";

/**
 * Options for {@link TranscriptExpander}.
 */
export interface TranscriptExpanderOptions {
  /**
   * Adjacent-window size in seconds. The expander pulls in any
   * stored chunk whose `timestamp` is within this window on
   * either side of a selected chunk. Default 30 seconds.
   * Timestamps use the same unit as transcript `offset`.
   */
  readonly windowSeconds?: number;
  /**
   * Optional cap on total text length (chars) added by expansion.
   * A candidate that would push the total past the cap is skipped;
   * scanning continues, so smaller candidates can still fit.
   * Default: no cap.
   */
  readonly maxAddedChars?: number;
}

/**
 * Transcript-aware expander. For each selected chunk with a
 * timestamp, loads same-document chunks from `ChunkRepository`
 * whose timestamps fall inside the window.
 *
 * Neighbors are scored at half the seed's score so budget
 * selection keeps the retrieved hit ahead of its surroundings.
 * With no chunk repository, the expander returns the input
 * unchanged: the selected set is not a neighbor corpus.
 */
export class TranscriptExpander implements Expander {
  public readonly name = "transcript";
  private readonly windowSeconds: number;
  private readonly maxAddedChars: number | undefined;

  constructor(options: TranscriptExpanderOptions = {}) {
    const w = options.windowSeconds ?? 30;
    if (!Number.isFinite(w) || w < 0) {
      throw new Error(`TranscriptExpander: windowSeconds must be a non-negative number, got ${w}`);
    }
    this.windowSeconds = w;
    if (options.maxAddedChars !== undefined) {
      if (!Number.isInteger(options.maxAddedChars) || options.maxAddedChars < 0) {
        throw new Error(
          `TranscriptExpander: maxAddedChars must be a non-negative integer, got ${options.maxAddedChars}`,
        );
      }
      this.maxAddedChars = options.maxAddedChars;
    }
  }

  public async expand(
    chunks: readonly ContextChunk[],
    ctx: ExpandContext = {},
  ): Promise<readonly ContextChunk[]> {
    if (chunks.length === 0) return [];
    const repo = ctx.chunkRepository;
    const toContextChunk = ctx.toContextChunk;
    if (repo === undefined || toContextChunk === undefined) return chunks;

    const seen = new Set<string>();
    const out: ContextChunk[] = [];
    for (const chunk of chunks) {
      const key = chunkKey(chunk.documentId, chunk.chunkId);
      if (seen.has(key)) continue;
      seen.add(key);
      out.push(chunk);
    }

    const listed = new Map<string, readonly Chunk[]>();
    const load = async (documentId: DocumentId): Promise<readonly Chunk[]> => {
      const key = String(documentId);
      const hit = listed.get(key);
      if (hit !== undefined) return hit;
      const rows = await repo.listByDocument(documentId);
      listed.set(key, rows);
      return rows;
    };

    let addedChars = 0;
    for (const seed of chunks) {
      const seedTimestamp = seed.timestamp;
      if (seedTimestamp === undefined) continue;
      const neighbors = await load(seed.documentId);
      for (const neighbor of neighbors) {
        const key = chunkKey(neighbor.documentId, neighbor.id);
        if (seen.has(key)) continue;
        const timestamp = neighbor.metadata["timestamp"];
        if (typeof timestamp !== "number") continue;
        if (Math.abs(timestamp - seedTimestamp) > this.windowSeconds) continue;
        const built = await toContextChunk(neighbor, discountNeighborScore(seed.score));
        if (built === undefined) continue;
        if (
          this.maxAddedChars !== undefined &&
          addedChars + built.text.length > this.maxAddedChars
        ) {
          continue;
        }
        seen.add(key);
        out.push(built);
        addedChars += built.text.length;
      }
    }
    return out;
  }
}

/** Lower a neighbor's score without ever raising a negative seed score. */
function discountNeighborScore(score: number): number {
  return score - Math.abs(score) * 0.5;
}

function chunkKey(documentId: { toString(): string }, chunkId: { toString(): string }): string {
  return `${String(documentId)}:${String(chunkId)}`;
}
