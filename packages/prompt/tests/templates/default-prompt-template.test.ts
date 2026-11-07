import { describe, expect, it } from "vitest";
import { DefaultPromptTemplate, DEFAULT_SYSTEM_INSTRUCTIONS } from "../../src/templates/index.js";

describe("DefaultPromptTemplate", () => {
  it("uses the default system instructions", () => {
    const t = new DefaultPromptTemplate();
    expect(t.system).toBe(DEFAULT_SYSTEM_INSTRUCTIONS);
  });

  it("accepts a custom system", () => {
    const t = new DefaultPromptTemplate({ system: "You are terse." });
    expect(t.system).toBe("You are terse.");
  });

  it("formatChunk renders a citation marker and the text", () => {
    const t = new DefaultPromptTemplate();
    const out = t.formatChunk({ text: "hello" }, 0, (i) => `[${i + 1}]`);
    expect(out).toBe("[1] hello");
  });

  it("formatChunk includes a speaker header when speaker is set", () => {
    const t = new DefaultPromptTemplate();
    const out = t.formatChunk({ text: "x", speaker: "Alice" }, 1, (i) => `[${i + 1}]`);
    expect(out).toBe("[2] Alice\nx");
  });

  it("formatChunk includes a timestamp header when timestamp is set", () => {
    const t = new DefaultPromptTemplate();
    const out = t.formatChunk({ text: "x", timestamp: 75 }, 0, (i) => `[${i + 1}]`);
    expect(out).toBe("[1] @ 01:15\nx");
  });

  it("formatChunk combines speaker and timestamp", () => {
    const t = new DefaultPromptTemplate();
    const out = t.formatChunk({ text: "x", speaker: "Alice", timestamp: 75 }, 0, (i) => `[${i + 1}]`);
    expect(out).toBe("[1] Alice @ 01:15\nx");
  });

  it("formatUser wraps the query with a Context: block when chunks are present", () => {
    const t = new DefaultPromptTemplate();
    const out = t.formatUser({ query: "Q?", rendered: ["[1] hello", "[2] world"], truncated: false });
    expect(out).toContain("Context:");
    expect(out).toContain("[1] hello");
    expect(out).toContain("[2] world");
    expect(out).toContain("Question:\nQ?");
  });

  it("formatUser skips the Context: block when no chunks are rendered", () => {
    const t = new DefaultPromptTemplate();
    const out = t.formatUser({ query: "Q?", rendered: [], truncated: false });
    expect(out).toBe("Question:\nQ?");
  });

  it("formatUser appends one source line per chunk using the chunk marker", () => {
    const t = new DefaultPromptTemplate();
    const out = t.formatUser({
      query: "Q?",
      rendered: ["[1] hello"],
      truncated: false,
      chunks: [
        {
          chunkId: "c" as never,
          documentId: "d" as never,
          text: "hello",
          score: 1,
          span: { start: 0, end: 5, sourceId: "d" as never },
          timestamp: 75,
          citation: { key: "d:c", label: "Talk", url: "https://www.youtube.com/watch?v=abc", marker: 1 },
        },
      ],
    });
    expect(out).toContain("Sources:\n[1] Talk @ 01:15 — https://www.youtube.com/watch?v=abc");
  });

  it("numbers the footer with the same citation format as the body", () => {
    const t = new DefaultPromptTemplate();
    const chunk = {
      chunkId: "c" as never,
      documentId: "d" as never,
      text: "x",
      score: 1,
      span: { start: 0, end: 1, sourceId: "d" as never },
      citation: { key: "d:c" },
    };
    const out = t.formatUser({
      query: "Q?",
      rendered: ["(1) x", "(2) y"],
      truncated: false,
      chunks: [chunk, { ...chunk, citation: { key: "d:c2" } }],
      cite: (index) => `(${index + 1})`,
    });
    expect(out).toContain("Sources:\n(1) d:c\n(2) d:c2");
  });

  it("formatUser notes truncation when truncated=true", () => {
    const t = new DefaultPromptTemplate();
    const out = t.formatUser({ query: "Q?", rendered: ["[1] hello"], truncated: true });
    expect(out).toContain("truncated");
  });
});
