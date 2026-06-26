import type { Retriever } from "../contracts/retriever.js";
import type { RetrievalResult } from "../contracts/retrieval-result.js";

/**
 * The HyDE retriever. HyDE (Gao et al., 2022) generates a
 * hypothetical passage that *would* answer the query, then
 * uses that passage as the search query.
 *
 * The intuition: in vector space, a real answer is closer to a
 * hypothetical answer than a question is. By searching with
 * the hypothetical answer's embedding, we hit the corpus in
 * the right neighborhood.
 *
 * Phase 2 ships a **deterministic template** expander. The
 * template is `"This document is about: <query>"`. Phase 3+
 * replaces this with an LLM-backed `HypotheticalPassageExpander`
 * that calls a generation model.
 */
export class HyDERetriever implements Retriever {
  private readonly inner: Retriever;
  private readonly template: string;

  constructor(options: { retriever: Retriever; template?: string }) {
    this.inner = options.retriever;
    this.template = options.template ?? "This document is about: ";
  }

  public async retrieve(query: string, k: number): Promise<RetrievalResult> {
    const t0 = Date.now();
    const hypothetical = this.template + query;
    const out = await this.inner.retrieve(hypothetical, k);
    return { query, results: out.results, durationMs: Date.now() - t0 };
  }
}
