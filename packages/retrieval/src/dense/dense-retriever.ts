import type { Embedder } from "@lyra-sdk/embedding";
import type { VectorIndex } from "@lyra-sdk/index";
import type { Chunk, ChunkRepository } from "@lyra-sdk/storage";
import type { ScoredChunk } from "../contracts/retrieval-result.js";
import type { RetrievalResult } from "../contracts/retrieval-result.js";
import type { Retriever } from "../contracts/retriever.js";

/**
 * Options for {@link DenseRetriever}. None required; constructor
 * injection carries the dependencies.
 */
export interface DenseRetrieverOptions {
  // Reserved for future tunables (rerank threshold, score floor, …).
  // Phase 1 has none.
}

/**
 * The dense retriever. Phase 1's only `Retriever` implementation.
 *
 * Algorithm:
 *   1. `embedder.embedMany([query])` to get the query vector.
 *   2. `index.search(queryVector, k)` to get `{ id, score }[]`.
 *   3. `chunks.getMany(ids)` to resolve ids to `Chunk` objects.
 *   4. Zip the candidates with the resolved chunks into `ScoredChunk[]`,
 *      dropping any that did not resolve.
 *   5. Return a `RetrievalResult` with the original query and elapsed
 *      milliseconds.
 *
 * The retriever does NOT know about parsers, chunk strategies, or
 * embedders beyond the contract surfaces. It is a leaf on the read
 * path. The pipeline (slice 9) is the only place that knows how all
 * the pieces fit together.
 */
export class DenseRetriever implements Retriever {
  private readonly index: VectorIndex;
  private readonly embedder: Embedder;
  private readonly chunks: ChunkRepository;

  constructor(deps: {
    index: VectorIndex;
    embedder: Embedder;
    chunks: ChunkRepository;
  }) {
    this.index = deps.index;
    this.embedder = deps.embedder;
    this.chunks = deps.chunks;
  }

  public async retrieve(query: string, k: number): Promise<RetrievalResult> {
    const t0 = now();
    const [queryEmbedding] = await this.embedder.embedMany([query]);
    if (!queryEmbedding) {
      return { query, results: [], durationMs: now() - t0 };
    }
    const candidates = await this.index.search(queryEmbedding.vector, k);
    const ids = candidates.map((c) => c.id);
    const [resolved, vectors] = await Promise.all([
      this.chunks.getMany(ids),
      this.index.getMany(ids),
    ]);

    const byId = new Map<string, Chunk>();
    for (const c of resolved) {
      if (c !== null) byId.set(c.id, c);
    }
    const vecById = new Map<string, Float32Array>();
    for (const v of vectors) {
      if (v !== null) vecById.set(v.id, v.vector);
    }
    const scored: ScoredChunk[] = [];
    for (const cand of candidates) {
      const chunk = byId.get(cand.id);
      if (chunk === undefined) continue;
      const embedding = vecById.get(cand.id);
      if (embedding !== undefined) {
        scored.push({ chunk, score: cand.score, embedding });
      } else {
        scored.push({ chunk, score: cand.score });
      }
    }
    return { query, results: scored, durationMs: now() - t0 };
  }
}

function now(): number {
  return Date.now();
}
