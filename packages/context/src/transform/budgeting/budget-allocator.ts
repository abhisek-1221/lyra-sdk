import type { ContextChunk } from "../../types/index.js";
import type { TokenCounter } from "./token-counter.js";
import type { TokenBudget } from "./token-budget.js";

/**
 * Selects chunks under a token cap.
 *
 * Walks in score order. A chunk that fits is kept. A chunk that
 * does not fit is skipped when a later chunk still fits in the
 * leftover budget. Otherwise it is the marginal chunk: its text
 * is shortened around `anchor` to the leftover tokens, it is
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
  const shortened = shortenToCost(chunk, remaining - joinTokens, count);
  if (shortened === undefined) return undefined;
  return { chunk: shortened.chunk, cost: shortened.cost + joinTokens };
}

/**
 * Shorten `chunk.text` until `count` fits in `maxCost`, keeping
 * the anchor passage inside the window.
 */
export function shortenToCost(
  chunk: ContextChunk,
  maxCost: number,
  count: (chunk: ContextChunk) => number,
): { readonly chunk: ContextChunk; readonly cost: number } | undefined {
  if (maxCost <= 0) return undefined;
  const whole = count(chunk);
  if (chunk.text.length > 0 && whole <= maxCost) return { chunk, cost: whole };
  const anchor = textAnchor(chunk);
  let best: ContextChunk | undefined;
  let bestCost = 0;
  let lo = 1;
  let hi = chunk.text.length;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    const text = windowOverAnchor(chunk.text, anchor.start, anchor.end, mid);
    if (text.length === 0) {
      hi = mid - 1;
      continue;
    }
    const candidate: ContextChunk = text === chunk.text ? chunk : { ...chunk, text };
    const cost = count(candidate);
    if (cost <= maxCost) {
      best = candidate;
      bestCost = cost;
      lo = mid + 1;
    } else {
      hi = mid - 1;
    }
  }
  if (best === undefined) return undefined;
  return { chunk: best, cost: bestCost };
}

/** Character offsets of `anchor` inside `chunk.text`. */
export function textAnchor(chunk: ContextChunk): { readonly start: number; readonly end: number } {
  const anchor = chunk.anchor ?? chunk.span;
  const length = chunk.text.length;
  const spanLength = chunk.span.end - chunk.span.start;
  if (spanLength <= 0 || length !== spanLength) return { start: 0, end: length };
  const start = clamp(anchor.start - chunk.span.start, 0, length);
  const end = clamp(anchor.end - chunk.span.start, start, length);
  return { start, end };
}

/**
 * A window of `maxChars` that covers the anchor. When the anchor
 * is longer than the window, the window starts at the anchor.
 */
export function windowOverAnchor(
  text: string,
  anchorStart: number,
  anchorEnd: number,
  maxChars: number,
): string {
  if (maxChars <= 0) return "";
  if (text.length <= maxChars) return text;
  const startBound = clamp(anchorStart, 0, text.length);
  const endBound = clamp(anchorEnd, startBound, text.length);
  if (endBound - startBound >= maxChars) return text.slice(startBound, startBound + maxChars);
  const extra = maxChars - (endBound - startBound);
  let start = startBound - Math.floor(extra / 2);
  if (start < 0) start = 0;
  if (start + maxChars > text.length) start = Math.max(0, text.length - maxChars);
  if (start > startBound) start = startBound;
  if (start + maxChars < endBound) start = Math.max(0, endBound - maxChars);
  return text.slice(start, start + maxChars);
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}
