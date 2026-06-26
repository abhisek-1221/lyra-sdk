import { createChunkId } from "@lyra-sdk/kernel";
import { describe, expect, it } from "vitest";
import { BM25Index } from "../../src/lexical/bm25/bm25-index.js";
import { BM25PlusScorer } from "../../src/lexical/bm25/bm25-plus-scorer.js";
import { EnglishTokenizer } from "../../src/lexical/english-tokenizer.js";

const id = createChunkId;

describe("BM25Index", () => {
  it("returns empty for an empty index", () => {
    const idx = new BM25Index();
    expect(idx.search("anything", 5)).toEqual([]);
  });

  it("returns empty for an empty query", () => {
    const idx = new BM25Index();
    idx.add(id("a"), "the quick brown fox");
    expect(idx.search("", 5)).toEqual([]);
  });

  it("ranks the most relevant chunk first", () => {
    const idx = new BM25Index();
    idx.add(id("a"), "the quick brown fox jumps over the lazy dog");
    idx.add(id("b"), "a recipe for chocolate cake");
    idx.add(id("c"), "the quick brown fox runs through the forest");
    const hits = idx.search("quick brown fox", 3);
    expect(hits.length).toBeGreaterThan(0);
    // 'a' and 'c' both contain all three query terms; 'b' contains none.
    expect(hits[0]?.id === "a" || hits[0]?.id === "c").toBe(true);
    // 'b' must be last (or absent if k=1).
    const lastHit = hits[hits.length - 1];
    expect(lastHit?.id).not.toBe("b");
  });

  it("scores chunks that contain the query terms higher than unrelated chunks", () => {
    const idx = new BM25Index();
    idx.add(id("relevant"), "javascript async await promises");
    idx.add(id("unrelated"), "chocolate cake recipe");
    const hits = idx.search("javascript async", 5);
    expect(hits[0]?.id).toBe("relevant");
  });

  it("respects k", () => {
    const idx = new BM25Index();
    for (let i = 0; i < 10; i++) {
      idx.add(id(`c${i}`), `document number ${i} with the word cat`);
    }
    expect(idx.search("cat", 3).length).toBe(3);
  });

  it("treats re-adding the same id as an update", () => {
    const idx = new BM25Index();
    idx.add(id("a"), "old content about cats");
    idx.add(id("a"), "new content about dogs");
    const oldHits = idx.search("cats", 5);
    const newHits = idx.search("dogs", 5);
    expect(oldHits.length).toBe(0);
    expect(newHits.length).toBe(1);
    expect(newHits[0]?.id).toBe("a");
  });

  it("remove deletes the chunk entirely", () => {
    const idx = new BM25Index();
    idx.add(id("a"), "the quick brown fox");
    idx.remove(id("a"));
    expect(idx.size()).toBe(0);
    expect(idx.search("fox", 5)).toEqual([]);
  });

  it("works with a custom scorer (BM25+)", () => {
    const scorer = new BM25PlusScorer();
    const idx = new BM25Index({ scorer });
    idx.add(id("a"), "javascript async");
    idx.add(id("b"), "chocolate cake");
    const hits = idx.search("javascript", 5);
    // BM25+ gives the missing term a small boost. We just check the
    // search ran without error and returned the right id.
    expect(hits[0]?.id).toBe("a");
  });

  it("works with a custom tokenizer (no stop-words)", () => {
    const tok = new EnglishTokenizer({ stopWords: [] });
    const idx = new BM25Index({ tokenizer: tok });
    idx.add(id("a"), "jQuery selects elements");
    const hits = idx.search("jQuery", 5);
    // With stop-words removed and no length cap on `jQuery`, the
    // search matches.
    expect(hits.length).toBe(1);
    expect(hits[0]?.id).toBe("a");
  });

  it("stats reflects the corpus", () => {
    const idx = new BM25Index();
    idx.add(id("a"), "foo bar");
    idx.add(id("b"), "bar baz");
    const s = idx.stats();
    expect(s.chunks).toBe(2);
    expect(s.terms).toBe(3);
  });
});
