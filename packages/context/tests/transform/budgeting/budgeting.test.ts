import type { ContextChunk } from "../../../src/types/index.js";
import { makeCitation } from "../../../src/citations/index.js";
import { createChunkId, createDocumentId } from "@lyra-sdk/kernel";
import { CharHeuristicTokenCounter } from "../../../src/transform/budgeting/token-counter.js";
import { makeTokenBudget } from "../../../src/transform/budgeting/token-budget.js";
import { BudgetAllocator } from "../../../src/transform/budgeting/budget-allocator.js";
import { describe, expect, it } from "vitest";

function chunk(text: string): ContextChunk {
  const docId = createDocumentId("doc-1");
  return {
    chunkId: createChunkId("c"),
    documentId: docId,
    text,
    score: 0.5,
    span: { start: 0, end: text.length, sourceId: docId },
    citation: makeCitation({ documentId: docId, chunkId: createChunkId("c") }),
  };
}

describe("CharHeuristicTokenCounter", () => {
  it("counts chars / 4 (rounded up)", () => {
    const c = new CharHeuristicTokenCounter();
    expect(c.count("")).toBe(0);
    expect(c.count("abcd")).toBe(1);
    expect(c.count("abcde")).toBe(2);
    expect(c.count("a".repeat(100))).toBe(25);
  });
});

describe("makeTokenBudget", () => {
  it("effective = total - reservedForResponse", () => {
    const b = makeTokenBudget(1000, 200);
    expect(b.effective()).toBe(800);
  });

  it("effective is clamped at 0 when reservedForResponse > total", () => {
    const b = makeTokenBudget(100, 200);
    expect(b.effective()).toBe(0);
  });
});

describe("BudgetAllocator", () => {
  it("includes chunks while under the budget", () => {
    const r = new BudgetAllocator({
      counter: new CharHeuristicTokenCounter(),
      budget: makeTokenBudget(100),
    });
    const out = r.allocate([chunk("a".repeat(40)), chunk("b".repeat(40))]);
    expect(out.included).toHaveLength(2);
    expect(out.truncated).toBe(false);
    expect(out.usedTokens).toBe(20); // 40/4 + 40/4
  });

  it("stops at the first chunk that would overflow the budget", () => {
    const r = new BudgetAllocator({
      counter: new CharHeuristicTokenCounter(),
      budget: makeTokenBudget(15),
    });
    const out = r.allocate([chunk("a".repeat(40)), chunk("b".repeat(40))]);
    // 40 chars / 4 = 10 tokens. Budget 15: first chunk (10) fits,
    // second chunk (10) would make 20 > 15, so dropped.
    expect(out.included).toHaveLength(1);
    expect(out.truncated).toBe(true);
  });

  it("truncated: true when input is longer than the budget", () => {
    const r = new BudgetAllocator({
      counter: new CharHeuristicTokenCounter(),
      budget: makeTokenBudget(5),
    });
    const out = r.allocate([chunk("a".repeat(40))]);
    expect(out.included).toHaveLength(0);
    expect(out.truncated).toBe(true);
    expect(out.usedTokens).toBe(0);
  });

  it("truncated: false when input fits exactly", () => {
    const r = new BudgetAllocator({
      counter: new CharHeuristicTokenCounter(),
      budget: makeTokenBudget(20),
    });
    const out = r.allocate([chunk("a".repeat(80))]);
    expect(out.included).toHaveLength(1);
    expect(out.truncated).toBe(false);
    expect(out.usedTokens).toBe(20);
  });
});
