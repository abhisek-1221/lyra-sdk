import type { Retriever } from "../contracts/retriever.js";
import type { RetrievalResult } from "../contracts/retrieval-result.js";

/**
 * Rewrite: a small set of deterministic, rule-based rewrites
 * applied to the query before retrieval. Phase 2 ships
 * filler-word stripping and case-folding.
 *
 * Future phases may add:
 *   - Spelling correction
 *   - Acronym expansion
 *   - LLM-based rewrite (a la `Rewrite-Retrieve-Read`)
 */
export class RewriteRetriever implements Retriever {
  private readonly inner: Retriever;
  private readonly fillerWords: ReadonlySet<string>;

  constructor(options: {
    retriever: Retriever;
    fillerWords?: readonly string[];
  }) {
    this.inner = options.retriever;
    this.fillerWords = new Set(
      (options.fillerWords ?? DEFAULT_FILLER_WORDS).map((w) => w.toLowerCase()),
    );
  }

  public async retrieve(query: string, k: number): Promise<RetrievalResult> {
    const t0 = Date.now();
    const rewritten = this.rewrite(query);
    const out = await this.inner.retrieve(rewritten, k);
    return { query, results: out.results, durationMs: Date.now() - t0 };
  }

  private rewrite(query: string): string {
    const tokens = query.split(/\s+/);
    const out: string[] = [];
    for (const tok of tokens) {
      const lower = tok.toLowerCase();
      if (this.fillerWords.has(lower)) continue;
      out.push(tok);
    }
    return out.join(" ").trim();
  }
}

const DEFAULT_FILLER_WORDS: readonly string[] = [
  "um", "uh", "er", "ah", "like", "you know", "i mean", "kinda", "sorta",
];
