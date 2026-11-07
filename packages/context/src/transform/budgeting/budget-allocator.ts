import type { ContextChunk } from "../../types/index.js";
import type { TokenCounter } from "./token-counter.js";
import type { TokenBudget } from "./token-budget.js";

/**
 * Selects chunks under a token cap.
 *
 * Walks in score order. A chunk that fits is kept. A chunk that
 * does not fit is skipped when a later chunk still fits in the
 * leftover budget. Otherwise it is the marginal chunk: its text
 * is shortened from the head to the leftover tokens, it is
 * included, and selection stops. The source `span` is unchanged.
 *
 * The highest-scoring chunk is shortened to the whole cap when
 * nothing has been selected yet, so one oversized chunk still
 * contributes text.
 */
export class BudgetAllocator {
  private readonly counter: TokenCounter;
  private readonly budget: TokenBudget;

  constructor(opts: { counter: TokenCounter; budget: TokenBudget }) {
    this.counter = opts.counter;
    this.budget = opts.budget;
  }

  public allocate(
    chunks: readonly ContextChunk[],
    opts?: {
      readonly cap?: number;
      readonly countChunkTokens?: (chunk: ContextChunk) => number;
      readonly joinTokens?: number;
    },
  ): { readonly included: readonly ContextChunk[]; readonly truncated: boolean; readonly usedTokens: number } {
    const cap = opts?.cap ?? this.budget.effective();
    const count = opts?.countChunkTokens ?? ((chunk: ContextChunk) => this.counter.count(chunk.text));
    const joinTokens = opts?.joinTokens ?? 0;
    const ranked = chunks
      .map((c, i) => ({ c, i }))
      .sort((a, b) => {
        if (b.c.score !== a.c.score) return b.c.score - a.c.score;
        return a.i - b.i;
      })
      .map((entry) => entry.c);

    const included: ContextChunk[] = [];
    let used = 0;
    let truncated = false;

    for (let i = 0; i < ranked.length; i++) {
      const chunk = ranked[i]!;
      const withJoin = included.length > 0;
      const cost = count(chunk) + (withJoin ? joinTokens : 0);
      if (cost > 0 && used + cost <= cap) {
        included.push(chunk);
        used += cost;
        continue;
      }
      if (cost === 0 && used <= cap) {
        included.push(chunk);
        continue;
      }
      const remaining = cap - used;
      if (included.length > 0 && laterFits(ranked, i, remaining, count, joinTokens)) {
        truncated = true;
        continue;
      }
      const fitted = fitChunk(chunk, remaining, withJoin ? joinTokens : 0, count);
      if (fitted !== undefined) {
        included.push(fitted.chunk);
        used += fitted.cost;
      }
      truncated = true;
      break;
    }
    if (!truncated && included.length < ranked.length) truncated = true;
    return { included, truncated, usedTokens: used };
  }
}

function laterFits(
  ranked: readonly ContextChunk[],
  index: number,
  remaining: number,
  count: (chunk: ContextChunk) => number,
  joinTokens: number,
): boolean {
  if (remaining <= 0) return false;
  for (let j = index + 1; j < ranked.length; j++) {
    const chunk = ranked[j];
    if (chunk === undefined) continue;
    const cost = count(chunk) + joinTokens;
    if (cost > 0 && cost <= remaining) return true;
  }
  return false;
}

function fitChunk(
  chunk: ContextChunk,
  remaining: number,
  joinTokens: number,
  count: (chunk: ContextChunk) => number,
): { readonly chunk: ContextChunk; readonly cost: number } | undefined {
  if (remaining <= joinTokens) return undefined;
  const textBudget = remaining - joinTokens;
  let best: ContextChunk | undefined;
  let bestCost = 0;
  let lo = 1;
  let hi = chunk.text.length;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    const candidate: ContextChunk = { ...chunk, text: chunk.text.slice(0, mid) };
    const cost = count(candidate);
    if (candidate.text.length > 0 && cost <= textBudget) {
      best = candidate;
      bestCost = cost;
      lo = mid + 1;
    } else {
      hi = mid - 1;
    }
  }
  if (best === undefined) return undefined;
  return { chunk: best, cost: bestCost + joinTokens };
}
