import type { ChunkId } from "@lyra-sdk/kernel";
import type { DocumentRepository } from "@lyra-sdk/storage";
import type { ScoredChunk, RetrievalResult } from "../contracts/retrieval-result.js";
import type { Retriever } from "../contracts/retriever.js";
import type { ChunkGrouping } from "./chunk-grouping.js";
import { DocumentSiblingGrouping } from "./chunk-grouping.js";
import type { ParentResolver } from "./parent-resolver.js";
import { LongestSpanParentResolver } from "./parent-resolver.js";

/**
 * Options for {@link ParentDocumentRetriever}.
 */
export interface ParentDocumentRetrieverOptions {
  /** The child retriever (typically a small-chunk dense or hybrid). */
  readonly retriever: Retriever;
  /** The repository used to look up sibling chunks. */
  readonly documents: DocumentRepository;
  /** The grouping strategy. Default: `DocumentSiblingGrouping`. */
  readonly grouping?: ChunkGrouping;
  /** The parent-resolver strategy. Default: `LongestSpanParentResolver`. */
  readonly parentResolver?: ParentResolver;
}

/**
 * The parent-document retriever. Runs a child retriever on
 * small chunks, then expands each hit to its "parent" region
 * (per the configured `ChunkGrouping` + `ParentResolver`).
 *
 * Use case: small chunks retrieve precisely but are hard for
 * an LLM to consume. Parent retrieval returns the larger
 * region the chunk belongs to, giving the LLM more context.
 *
 * Algorithm:
 *   1. `child.retrieve(query, k)` returns top-k small chunks.
 *   2. For each child chunk, find its sibling group via
 *      `grouping.siblings(chunk, documents)`.
 *   3. For each group, pick the parent via
 *      `parentResolver.resolve(chunk, group)`.
 *   4. Deduplicate parents (preserve the highest score).
 *   5. Re-rank by max score, slice to `k`.
 *   6. Return `RetrievalResult` with the original query and elapsed ms.
 *
 * The retriever is a **decorator**. It does not own the child
 * retriever; the composition is `ParentDocumentRetriever(HybridRetriever(DenseRetriever, BM25Retriever), ...)`,
 * the canonical Phase 2 composition.
 */
export class ParentDocumentRetriever implements Retriever {
  private readonly retriever: Retriever;
  private readonly documents: DocumentRepository;
  private readonly grouping: ChunkGrouping;
  private readonly parentResolver: ParentResolver;

  constructor(options: ParentDocumentRetrieverOptions) {
    this.retriever = options.retriever;
    this.documents = options.documents;
    this.grouping = options.grouping ?? new DocumentSiblingGrouping();
    this.parentResolver = options.parentResolver ?? new LongestSpanParentResolver();
  }

  public async retrieve(query: string, k: number): Promise<RetrievalResult> {
    const t0 = Date.now();
    const child = await this.retriever.retrieve(query, k);

    // Dedupe by child chunk id, keeping the highest score.
    const scoreByChunk = new Map<ChunkId, number>();
    for (const sc of child.results) {
      const existing = scoreByChunk.get(sc.chunk.id);
      if (existing === undefined || sc.score > existing) {
        scoreByChunk.set(sc.chunk.id, sc.score);
      }
    }

    // Resolve each child to its parent.
    const seen = new Set<ChunkId>();
    const out: ScoredChunk[] = [];
    for (const sc of child.results) {
      if (seen.has(sc.chunk.id)) continue;
      const siblings = await this.grouping.siblings(sc.chunk, this.documents);
      const parent = this.parentResolver.resolve(sc.chunk, siblings);
      if (seen.has(parent.id)) continue;
      seen.add(parent.id);
      out.push({ chunk: parent, score: scoreByChunk.get(sc.chunk.id) ?? sc.score });
    }

    // Re-rank by score descending, tiebreak by id asc.
    out.sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      return (a.chunk.id as string) < (b.chunk.id as string)
        ? -1
        : (a.chunk.id as string) > (b.chunk.id as string)
          ? 1
          : 0;
    });
    return { query, results: out.slice(0, k), durationMs: Date.now() - t0 };
  }
}
