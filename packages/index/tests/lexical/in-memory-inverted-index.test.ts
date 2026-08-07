import { createChunkId } from "@lyra-sdk/kernel";
import { describe, expect, it } from "vitest";
import { InMemoryInvertedIndex } from "../../src/lexical/in-memory-inverted-index.js";
import { EnglishTokenizer } from "../../src/lexical/english-tokenizer.js";

const id = createChunkId;
const tok = (text: string) => new EnglishTokenizer({ stopWords: [] }).tokenize(text);

describe("InMemoryInvertedIndex", () => {
  it("starts empty", () => {
    const idx = new InMemoryInvertedIndex();
    expect(idx.size()).toBe(0);
    expect(idx.postingsFor("anything")).toEqual([]);
    expect(idx.averageChunkLength()).toBe(0);
  });

  it("add indexes a chunk's tokens", () => {
    const idx = new InMemoryInvertedIndex();
    idx.add(id("a"), tok("the quick brown fox"));
    expect(idx.size()).toBe(1);
    const p = idx.postingsFor("fox");
    expect(p.length).toBe(1);
    expect(p[0]?.chunkId).toBe("a");
    expect(p[0]?.termFrequency).toBe(1);
  });

  it("aggregates term frequency across multiple occurrences", () => {
    const idx = new InMemoryInvertedIndex();
    idx.add(id("a"), tok("foo foo foo bar"));
    const p = idx.postingsFor("foo");
    expect(p[0]?.termFrequency).toBe(3);
  });

  it("add is upsert: re-adding a chunk replaces its postings", () => {
    const idx = new InMemoryInvertedIndex();
    idx.add(id("a"), tok("apple banana"));
    idx.add(id("a"), tok("cherry"));
    expect(idx.postingsFor("apple")).toEqual([]);
    expect(idx.postingsFor("banana")).toEqual([]);
    const cherry = idx.postingsFor("cherry");
    expect(cherry.length).toBe(1);
    expect(idx.size()).toBe(1);
  });

  it("remove is idempotent", () => {
    const idx = new InMemoryInvertedIndex();
    idx.add(id("a"), tok("foo bar"));
    idx.remove(id("a"));
    idx.remove(id("a"));
    expect(idx.size()).toBe(0);
    expect(idx.postingsFor("foo")).toEqual([]);
  });

  it("remove cleans up empty posting lists", () => {
    const idx = new InMemoryInvertedIndex();
    idx.add(id("a"), tok("unique"));
    idx.add(id("b"), tok("unique other"));
    expect(idx.postingsFor("unique").length).toBe(2);
    idx.remove(id("a"));
    expect(idx.postingsFor("unique").length).toBe(1);
    idx.remove(id("b"));
    // The "unique" term is now gone entirely (no postings).
    expect(idx.postingsFor("unique").length).toBe(0);
  });

  it("averageChunkLength is updated incrementally", () => {
    const idx = new InMemoryInvertedIndex();
    idx.add(id("a"), tok("foo bar baz"));
    idx.add(id("b"), tok("foo bar baz qux quux"));
    expect(idx.averageChunkLength()).toBeCloseTo(4, 5);
  });

  it("stats reflects terms and chunks", () => {
    const idx = new InMemoryInvertedIndex();
    idx.add(id("a"), tok("foo bar"));
    idx.add(id("b"), tok("bar baz"));
    const s = idx.stats();
    expect(s.chunks).toBe(2);
    expect(s.terms).toBe(3);
    expect(s.memoryUsage).toBeGreaterThan(0);
  });
});
