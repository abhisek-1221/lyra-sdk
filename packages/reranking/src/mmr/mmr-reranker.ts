import { KernelError } from "@lyra-sdk/kernel";
import type { ScoredChunk } from "@lyra-sdk/retrieval";
import type { RerankResult, RerankerOptions } from "../contracts/index.js";
import type { Reranker } from "../contracts/reranker.js";

/**
 * Options for {@link MMRReranker}.
 *
 * - `lambda` is the relevance-vs-diversity knob. 1.0 = pure
 *   relevance (no diversity penalty), 0.0 = pure diversity.
 *   0.5–0.7 is the typical RAG range.
 * - `topK` is the number of chunks to return. Default is the
 *   candidate count (no filtering). The cascade pattern is
 *   `MMR(20) -> CrossEncoder(10)`, dropping the bulk of the
 *   candidates cheaply before paying for cross-encoder inference.
 * - `queryEmbedding` is the vector for the query, produced
 *   upstream. MMR never calls an embedder; the caller passes
 *   the same vector the retriever would have computed.
 */
export interface MMRRerankerOptions extends RerankerOptions {
  /** Relevance vs. diversity, in [0, 1]. */
  readonly lambda: number;
  /** How many chunks to return. Default: candidates.length. */
  readonly topK: number;
  /** Required. Vector for the query, produced upstream. */
  readonly queryEmbedding: Float32Array;
}

/**
 * Maximum Marginal Relevance (Carbonell & Goldstein, 1998).
 *
 * Iteratively pick the next chunk that maximizes
 *
 *   λ · sim(c, q) − (1 − λ) · max_sim(c, picked)
 *
 * `sim` is cosine similarity. The algorithm requires every
 * candidate to carry its embedding; the reranker never re-embeds.
 *
 * Behavioural contract (enforced by tests):
 *   - If `candidates.length === 0` or `1`, return as-is.
 *   - If `queryEmbedding` is missing, throw
 *     `KernelError("invalid_argument", ...)`.
 *   - If any candidate is missing `ScoredChunk.embedding`, throw
 *     `KernelError("invalid_argument", ...)`.
 *   - `lambda = 1.0` degenerates to "top-K by score" (no diversity
 *     penalty). `lambda = 0.0` is "top-K most diverse" (no relevance).
 *   - Result is a permutation of the input, with at most `topK`
 *     elements. Same `ScoredChunk` instances (identity preserved).
 *   - Diagnostics carry `mmrScores: readonly number[]` for the
 *     selected order, useful for debugging.
 */
export class MMRReranker implements Reranker {
  public readonly name: string;

  private readonly lambda: number;
  private readonly topK: number;
  private readonly queryEmbedding: Float32Array;

  constructor(options: MMRRerankerOptions) {
    if (!Number.isFinite(options.lambda) || options.lambda < 0 || options.lambda > 1) {
      throw new KernelError(
        "invalid_argument",
        `MMRReranker: lambda must be in [0, 1], got ${options.lambda}`,
      );
    }
    if (!Number.isInteger(options.topK) || options.topK < 0) {
      throw new KernelError(
        "invalid_argument",
        `MMRReranker: topK must be a non-negative integer, got ${options.topK}`,
      );
    }
    if (options.queryEmbedding.length === 0) {
      throw new KernelError(
        "invalid_argument",
        "MMRReranker: queryEmbedding must be a non-empty Float32Array",
      );
    }
    this.lambda = options.lambda;
    this.topK = options.topK;
    this.queryEmbedding = options.queryEmbedding;
    this.name = options.name ?? `mmr-${options.lambda.toFixed(2)}`;
  }

  public async rerank(
    _query: string,
    candidates: readonly ScoredChunk[],
    _options?: RerankerOptions,
  ): Promise<RerankResult> {
    const start = Date.now();
    const n = candidates.length;
    if (n === 0) {
      return { results: [], durationMs: Date.now() - start };
    }
    if (n === 1) {
      return { results: candidates, durationMs: Date.now() - start };
    }
    // Effective topK is min(topK, candidates.length).
    const k = Math.min(this.topK, n);
    if (k === 0) {
      return { results: [], durationMs: Date.now() - start };
    }
    // Pre-compute query similarities. Pre-compute pairwise
    // similarities lazily inside the inner loop.
    const querySims = new Float32Array(n);
    for (let i = 0; i < n; i++) {
      const cand = candidates[i]!;
      const emb = cand.embedding;
      if (emb === undefined) {
        throw new KernelError(
          "invalid_argument",
          `MMRReranker: candidate ${String(cand.chunk.id)} is missing ScoredChunk.embedding; rerankers do not re-embed`,
        );
      }
      querySims[i] = cosineSim(this.queryEmbedding, emb);
    }
    const selected: number[] = [];
    const mmrScores: number[] = [];
    const used = new Uint8Array(n);
    // Pre-compute and cache the upper-bound "max sim to selected"
    // for unselected candidates. Updates as we add to `selected`.
    const maxSimToSelected = new Float32Array(n);
    // `lambda = 1` short-circuit: pick top-K by querySim desc,
    // skipping the inner-loop diversity work.
    if (this.lambda === 1) {
      const order = argsortDesc(querySims);
      for (let s = 0; s < k; s++) {
        const idx = order[s]!;
        selected.push(idx);
        mmrScores.push(querySims[idx]!);
        used[idx] = 1;
      }
      const out = selected.map((i) => candidates[i]!);
      return {
        results: out,
        durationMs: Date.now() - start,
        diagnostics: { mmrScores, lambda: this.lambda, topK: this.topK },
      };
    }
    for (let step = 0; step < k; step++) {
      let bestIdx = -1;
      let bestScore = -Infinity;
      for (let i = 0; i < n; i++) {
        if (used[i] === 1) continue;
        const rel = this.lambda * querySims[i]!;
        const div = (1 - this.lambda) * maxSimToSelected[i]!;
        const score = rel - div;
        if (score > bestScore) {
          bestScore = score;
          bestIdx = i;
        }
      }
      if (bestIdx === -1) break;
      selected.push(bestIdx);
      mmrScores.push(bestScore);
      used[bestIdx] = 1;
      // Update maxSimToSelected for unselected candidates.
      const newEmb = candidates[bestIdx]!.embedding;
      if (newEmb === undefined) {
        // Unreachable: validated above for the first iteration; the
        // first `selected` push ensures we only reach this path for
        // candidates already validated.
        throw new KernelError(
          "invalid_argument",
          `MMRReranker: candidate ${String(candidates[bestIdx]!.chunk.id)} lost its embedding mid-run`,
        );
      }
      for (let j = 0; j < n; j++) {
        if (used[j] === 1) continue;
        const otherEmb = candidates[j]!.embedding;
        if (otherEmb === undefined) continue;
        const s = cosineSim(newEmb, otherEmb);
        if (s > maxSimToSelected[j]!) maxSimToSelected[j] = s;
      }
    }
    const out = selected.map((i) => candidates[i]!);
    return {
      results: out,
      durationMs: Date.now() - start,
      diagnostics: { mmrScores, lambda: this.lambda, topK: this.topK },
    };
  }
}

/**
 * Cosine similarity between two vectors. Assumes the inputs are
 * unit-normalized (Lyra's `L2Normalizer` and the embedders
 * themselves return normalized vectors); the cosine formula
 * collapses to a dot product in that case. We do not re-normalize
 * here — that's the caller's responsibility.
 */
function cosineSim(a: Float32Array, b: Float32Array): number {
  if (a.length !== b.length) {
    throw new KernelError(
      "invalid_argument",
      `MMRReranker: dimension mismatch (${a.length} vs ${b.length})`,
    );
  }
  let s = 0;
  for (let i = 0; i < a.length; i++) {
    s += (a[i] ?? 0) * (b[i] ?? 0);
  }
  return s;
}

/**
 * Stable argsort descending. Ties broken by index asc (deterministic).
 */
function argsortDesc(values: Float32Array): number[] {
  const idx = new Array(values.length);
  for (let i = 0; i < values.length; i++) idx[i] = i;
  idx.sort((a, b) => {
    const va = values[a]!;
    const vb = values[b]!;
    if (vb !== va) return vb - va;
    return a - b;
  });
  return idx;
}
