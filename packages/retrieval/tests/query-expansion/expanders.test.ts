import { describe, expect, it } from "vitest";
import { IdentityExpander } from "../../src/query-expansion/expanders/identity-expander.js";
import { SynonymExpander } from "../../src/query-expansion/expanders/synonym-expander.js";
import { SubQueryExpander } from "../../src/query-expansion/expanders/sub-query-expander.js";

describe("IdentityExpander", () => {
  it("returns the input unchanged", async () => {
    const e = new IdentityExpander();
    const out = await e.expand("hello world");
    expect(out).toEqual(["hello world"]);
  });
});

describe("SynonymExpander", () => {
  const e = new SynonymExpander();

  it("always includes the original", async () => {
    const out = await e.expand("hello world");
    expect(out[0]).toBe("hello world");
  });

  it("expands known synonyms", async () => {
    const out = await e.expand("how to make a fast website");
    expect(out[0]).toBe("how to make a fast website");
    // 'fast' is in the synonym table; expect at least one alternative.
    expect(out.length).toBeGreaterThan(1);
    // The alternative should have a synonym of 'fast' replacing 'fast'.
    const alt = out[1]!;
    expect(alt).not.toBe("how to make a fast website");
  });

  it("returns just the original for unknown words", async () => {
    const out = await e.expand("zorglub quux");
    expect(out).toEqual(["zorglub quux"]);
  });

  it("respects a custom synonym table", async () => {
    const custom = new SynonymExpander({
      synonyms: new Map([["foo", ["bar"]]]),
    });
    const out = await custom.expand("foo baz");
    expect(out.length).toBe(2);
    expect(out[1]).toBe("bar baz");
  });
});

describe("SubQueryExpander", () => {
  const e = new SubQueryExpander();

  it("returns the input unchanged when no separator is present", async () => {
    const out = await e.expand("simple query");
    expect(out).toEqual(["simple query"]);
  });

  it("splits on question marks", async () => {
    const out = await e.expand("What is X? How does Y work?");
    expect(out.length).toBe(3);
    expect(out[0]).toBe("What is X? How does Y work?");
  });

  it("splits on ' and '", async () => {
    const out = await e.expand("show me cats and dogs");
    expect(out.length).toBe(3);
    // The original is always first.
    expect(out[0]).toBe("show me cats and dogs");
    // The two halves are the remaining entries.
    expect(out).toContain("show me cats");
    expect(out).toContain("dogs");
  });

  it("deduplicates repeated sub-queries", async () => {
    const out = await e.expand("foo? foo?");
    // Original + one sub. Repeated sub is dropped.
    expect(out.length).toBe(2);
    expect(out[0]).toBe("foo? foo?");
  });

  it("returns the original as the first entry", async () => {
    const out = await e.expand("a? b");
    expect(out[0]).toBe("a? b");
  });
});
