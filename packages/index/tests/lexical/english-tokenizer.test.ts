import { describe, expect, it } from "vitest";
import { EnglishTokenizer, DEFAULT_STOP_WORDS } from "../../src/lexical/english-tokenizer.js";

describe("EnglishTokenizer", () => {
  it("lowercases and splits on punctuation", () => {
    const t = new EnglishTokenizer({ stopWords: [] });
    expect(t.tokenize("Hello, World!")).toEqual(["hello", "world"]);
  });

  it("splits on whitespace, hyphens, and underscores", () => {
    const t = new EnglishTokenizer({ stopWords: [] });
    expect(t.tokenize("foo-bar_baz  qux")).toEqual(["foo", "bar", "baz", "qux"]);
  });

  it("returns empty for empty input", () => {
    const t = new EnglishTokenizer();
    expect(t.tokenize("")).toEqual([]);
  });

  it("drops single-character tokens by default", () => {
    const t = new EnglishTokenizer({ stopWords: [] });
    expect(t.tokenize("a I x to be or not")).toEqual(["to", "be", "or", "not"]);
  });

  it("filters default stop-words", () => {
    const t = new EnglishTokenizer();
    const tokens = t.tokenize("the quick brown fox is fast");
    expect(tokens).toEqual(["quick", "brown", "fox", "fast"]);
  });

  it("a custom stop-word list replaces the defaults", () => {
    // Pass an empty array to disable filtering entirely.
    const none = new EnglishTokenizer({ stopWords: [] });
    expect(none.tokenize("the quick brown fox")).toEqual(["the", "quick", "brown", "fox"]);
    // Pass a custom list; defaults are no longer applied.
    const custom = new EnglishTokenizer({ stopWords: ["quick"] });
    expect(custom.tokenize("the quick brown fox")).toEqual(["the", "brown", "fox"]);
  });

  it("supports a custom minimum length", () => {
    const t = new EnglishTokenizer({ minLength: 4, stopWords: [] });
    expect(t.tokenize("a an the foo bar foobar")).toEqual(["foobar"]);
  });

  it("handles Unicode letters", () => {
    const t = new EnglishTokenizer({ stopWords: [] });
    expect(t.tokenize("café résumé naïve")).toEqual(["café", "résumé", "naïve"]);
  });

  it("DEFAULT_STOP_WORDS contains common English words", () => {
    expect(DEFAULT_STOP_WORDS).toContain("the");
    expect(DEFAULT_STOP_WORDS).toContain("and");
    expect(DEFAULT_STOP_WORDS.length).toBeGreaterThan(20);
  });
});
