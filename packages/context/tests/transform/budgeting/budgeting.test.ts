import type { ContextChunk } from "../../../src/types/index.js";
import { makeCitation } from "../../../src/citations/index.js";
import { createChunkId, createDocumentId } from "@lyra-sdk/kernel";
import { CharHeuristicTokenCounter } from "../../../src/transform/budgeting/token-counter.js";
import { makeTokenBudget } from "../../../src/transform/budgeting/token-budget.js";
import { BudgetAllocator } from "../../../src/transform/budgeting/budget-allocator.js";
import { describe, expect, it } from "vitest";

function chunk(text: string, score = 0.5, id = "c"): ContextChunk {
  const docId = createDocumentId("doc-1");
  return {
    chunkId: createChunkId(id),
    documentId: docId,
    text,
    score,
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

  it("shortens the marginal chunk instead of dropping the rest of the budget", () => {
    const r = new BudgetAllocator({
      counter: new CharHeuristicTokenCounter(),
      budget: makeTokenBudget(15),
    });
    const out = r.allocate([chunk("a".repeat(40), 0.9, "a"), chunk("b".repeat(40), 0.8, "b")]);
    // 40 chars / 4 = 10 tokens. Budget 15: first chunk fits,
    // second is shortened to the remaining 5 tokens (20 chars).
    expect(out.included).toHaveLength(2);
    expect(out.included[1]?.text).toBe("b".repeat(20));
    expect(out.included[1]?.span.end).toBe(40);
    expect(out.truncated).toBe(true);
    expect(out.usedTokens).toBe(15);
  });

  it("skips a chunk that does not fit when a later chunk does", () => {
    const r = new BudgetAllocator({
      counter: new CharHeuristicTokenCounter(),
      budget: makeTokenBudget(14),
    });
    const out = r.allocate([
      chunk("a".repeat(40), 0.9, "a"),
      chunk("b".repeat(40), 0.8, "b"),
      chunk("c".repeat(16), 0.7, "c"),
    ]);
    expect(out.included.map((c) => String(c.chunkId))).toEqual([
      String(createChunkId("a")),
      String(createChunkId("c")),
    ]);
    expect(out.truncated).toBe(true);
    expect(out.usedTokens).toBe(14);
  });

  it("shortens a single chunk that is larger than the budget", () => {
    const r = new BudgetAllocator({
      counter: new CharHeuristicTokenCounter(),
      budget: makeTokenBudget(5),
    });
    const out = r.allocate([chunk("a".repeat(40))]);
    expect(out.included).toHaveLength(1);
    expect(out.included[0]?.text).toHaveLength(20);
    expect(out.truncated).toBe(true);
    expect(out.usedTokens).toBe(5);
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
