import type { Chunk, ChunkRepository, DocumentRepository } from "@lyra-sdk/storage";
import type { RetrievalResult, ScoredChunk } from "../contracts/retrieval-result.js";
import type { Retriever } from "../contracts/retriever.js";
import type { BM25Index, BM25SearchHit } from "@lyra-sdk/index";

/**
 * Options for {@link BM25Retriever}.
 *
 * `documents` is required for future hooks (e.g. snippet
 * generation, citation display). Phase 2's `BM25Retriever` does not
 * read from the documents at search time — the index already holds
 * the tokenized text — but the field is on the contract for
 * symmetry with `DenseRetriever` and to keep the constructor
 * signature stable when Phase 3+ adds document-aware behaviors.
 */
export interface BM25RetrieverOptions {
  readonly index: BM25Index;
  readonly chunks: ChunkRepository;
  readonly documents: DocumentRepository;
}

/**
 * The lexical `BM25Retriever`. Phase 2's only lexical `Retriever`.
 *
 * Algorithm:
 *   1. `index.search(query, k)` returns top-k `BM25SearchHit`s.
 *   2. `chunks.getMany(ids)` resolves ids to `Chunk` objects in one call.
 *   3. Zip hits with resolved chunks into `ScoredChunk[]`, dropping
 *      any that did not resolve.
 *   4. Return `RetrievalResult` with the original query and elapsed ms.
 *
 * The retriever is **query-only** — it does not own the index's
 * lifecycle. Indexing happens at ingest time (the pipeline does
 * this; Sprint 5 wires the optional `lexicalIndex` into the
 * pipeline's `RetrievalPipelineDeps`).
 */
export class BM25Retriever implements Retriever {
  private readonly index: BM25Index;
  private readonly chunks: ChunkRepository;

  constructor(options: BM25RetrieverOptions) {
    this.index = options.index;
    this.chunks = options.chunks;
    // `documents` is part of the contract for forward-compatibility
    // (Phase 3+ may need it for snippet generation). The Phase 2
    // retriever does not query the documents repository at search
    // time — the index already holds the tokenized text.
    void options.documents;
  }

  public async retrieve(query: string, k: number): Promise<RetrievalResult> {
    const t0 = Date.now();
    const hits: readonly BM25SearchHit[] = this.index.search(query, k);
    if (hits.length === 0) {
      return { query, results: [], durationMs: Date.now() - t0 };
    }
    const ids = hits.map((h: BM25SearchHit) => h.id);
    const resolved = await this.chunks.getMany(ids);
    const byId = new Map<string, Chunk>();
    for (const c of resolved) {
      if (c !== null) byId.set(c.id, c);
    }
    const scored: ScoredChunk[] = [];
    for (const h of hits) {
      const chunk = byId.get(h.id);
      if (chunk !== undefined) {
        scored.push({ chunk, score: h.score });
      }
    }
    return { query, results: scored, durationMs: Date.now() - t0 };
  }
}
