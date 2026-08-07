import type { ChunkId } from "@lyra-sdk/kernel";
import type { Posting } from "./posting-list.js";
import type {
  InvertedIndex,
  LexicalDocumentStats,
  LexicalIndexStats,
} from "./inverted-index.js";

/**
 * The Phase 2 in-memory `InvertedIndex`. `Map<term, Posting[]>` for
 * the postings, plus a `Map<chunkId, number>` for per-chunk
 * unique-token length.
 *
 * Memory model: a 100k-chunk corpus with an average of 50 unique
 * terms per chunk fits in ~50MB. Phase 2.5 will move this to
 * SQLite (mmap'd) for million-chunk corpora.
 */
export class InMemoryInvertedIndex implements InvertedIndex {
  private readonly postings = new Map<string, Posting[]>();
  private readonly chunkLengthsById = new Map<ChunkId, number>();
  private runningSum = 0;
  private runningCount = 0;

  public add(chunkId: ChunkId, tokens: readonly string[]): void {
    // Compute term frequencies in a single pass.
    const tf = new Map<string, number>();
    for (const tok of tokens) {
      tf.set(tok, (tf.get(tok) ?? 0) + 1);
    }
    const uniqueLength = tf.size;

    // Remove the chunk's previous postings so df stays in sync.
    this.remove(chunkId);

    for (const [term, termFrequency] of tf) {
      const list = this.postings.get(term);
      const posting: Posting = { chunkId, termFrequency };
      if (list === undefined) {
        this.postings.set(term, [posting]);
      } else {
        list.push(posting);
      }
    }

    this.chunkLengthsById.set(chunkId, uniqueLength);
    this.runningSum += uniqueLength;
    this.runningCount += 1;
  }

  public remove(chunkId: ChunkId): void {
    for (const [term, list] of this.postings) {
      const filtered = list.filter((p) => p.chunkId !== chunkId);
      if (filtered.length === 0) {
        this.postings.delete(term);
      } else if (filtered.length !== list.length) {
        this.postings.set(term, filtered);
      }
    }
    const prev = this.chunkLengthsById.get(chunkId);
    if (prev !== undefined) {
      this.chunkLengthsById.delete(chunkId);
      this.runningSum -= prev;
      this.runningCount -= 1;
    }
  }

  public postingsFor(term: string): readonly Posting[] {
    return this.postings.get(term) ?? [];
  }

  public size(): number {
    return this.chunkLengthsById.size;
  }

  public stats(): LexicalIndexStats {
    let bytes = 0;
    for (const list of this.postings.values()) {
      bytes += list.length * 24; // Posting object overhead (rough)
    }
    for (const term of this.postings.keys()) {
      bytes += term.length * 2; // UTF-16 string overhead (rough)
    }
    for (const id of this.chunkLengthsById.keys()) {
      bytes += (id as string).length * 2 + 16;
    }
    bytes += this.postings.size * 64; // Map node overhead
    return {
      chunks: this.chunkLengthsById.size,
      terms: this.postings.size,
      averageChunkLength: this.runningCount > 0 ? this.runningSum / this.runningCount : 0,
      memoryUsage: bytes,
    };
  }

  public chunkLengths(): readonly LexicalDocumentStats[] {
    const out: LexicalDocumentStats[] = [];
    for (const [chunkId, length] of this.chunkLengthsById) {
      out.push({ chunkId, length });
    }
    return out;
  }

  public averageChunkLength(): number {
    if (this.runningCount === 0) return 0;
    return this.runningSum / this.runningCount;
  }
}
