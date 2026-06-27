import type { Context, ContextChunk, ContextCitation } from "@lyra-sdk/context";
import { describe, expect, it } from "vitest";
import { DefaultPromptBuilder } from "../../src/builder/index.js";
import type { Prompt } from "../../src/builder/index.js";

function makeChunk(overrides: Partial<ContextChunk> = {}): ContextChunk {
  return {
    chunkId: "chunk-1" as never,
    documentId: "doc-1" as never,
    text: "Some text",
    score: 0.5,
    span: { start: 0, end: 9 } as never,
    citation: { key: "doc-1:chunk-1" } as ContextCitation,
    ...overrides,
  };
}

function makeContext(chunks: readonly ContextChunk[], overrides: Partial<Context> = {}): Context {
  return {
    chunks,
    citations: chunks.map((c) => c.citation),
    usedTokens: 0,
    tokenBudget: 0,
    truncated: false,
    diagnostics: {},
    ...overrides,
  };
}

describe("DefaultPromptBuilder", () => {
  it("emits a prompt with [system, user] when the context is empty", () => {
    const builder = new DefaultPromptBuilder();
    const prompt = builder.build({ query: "What?", context: makeContext([]) });
    expect(prompt.system).toBeTruthy();
    expect(prompt.messages).toHaveLength(2);
    expect(prompt.messages[0]?.role).toBe("system");
    expect(prompt.messages[1]?.role).toBe("user");
    expect(prompt.messages[1]?.content).toBe("Question:\nWhat?");
    expect(prompt.schema).toBeUndefined();
    expect(prompt.estimatedInputTokens).toBeGreaterThan(0);
  });

  it("emits a Context: block when chunks are present", () => {
    const builder = new DefaultPromptBuilder();
    const ctx = makeContext([makeChunk({ text: "alpha" })]);
    const prompt = builder.build({ query: "Q?", context: ctx });
    expect(prompt.messages[1]?.content).toContain("Context:");
    expect(prompt.messages[1]?.content).toContain("alpha");
    expect(prompt.messages[1]?.content).toContain("[1]");
  });

  it("uses a custom system override", () => {
    const builder = new DefaultPromptBuilder();
    const prompt = builder.build({ query: "Q?", context: makeContext([]), system: "Be terse." });
    expect(prompt.system).toBe("Be terse.");
    expect(prompt.messages[0]?.content).toBe("Be terse.");
  });

  it("uses a custom citationFormat", () => {
    const builder = new DefaultPromptBuilder();
    const ctx = makeContext([makeChunk({ text: "alpha" })]);
    const prompt = builder.build({ query: "Q?", context: ctx, citationFormat: (i) => `^${i + 1}^` });
    expect(prompt.messages[1]?.content).toContain("^1^");
  });

  it("uses a custom template's formatChunk", () => {
    const builder = new DefaultPromptBuilder({
      template: {
        system: "S",
        formatChunk: (chunk, i) => `(chunk-${i}:${chunk.text})`,
        formatUser: ({ query, rendered }) => `${rendered.join("|")}|Q:${query}`,
      },
    });
    const ctx = makeContext([makeChunk({ text: "a" }), makeChunk({ text: "b" })]);
    const prompt = builder.build({ query: "Q?", context: ctx });
    expect(prompt.messages[1]?.content).toBe("(chunk-0:a)|(chunk-1:b)|Q:Q?");
  });

  it("does not mutate the context or its chunks", () => {
    const builder = new DefaultPromptBuilder();
    const chunk = makeChunk({ text: "a" });
    const ctx = makeContext([chunk]);
    const snapshot = JSON.stringify(ctx);
    builder.build({ query: "Q?", context: ctx });
    expect(JSON.stringify(ctx)).toBe(snapshot);
  });

  it("preserves prior conversation messages and appends a new turn", () => {
    const builder = new DefaultPromptBuilder();
    const prompt = builder.build({
      query: "Q2?",
      context: makeContext([]),
      conversation: {
        messages: [
          { role: "user", content: "Q1?" },
          { role: "assistant", content: "A1." },
        ],
      },
    });
    expect(prompt.messages).toHaveLength(4);
    expect(prompt.messages[0]).toEqual({ role: "user", content: "Q1?" });
    expect(prompt.messages[1]).toEqual({ role: "assistant", content: "A1." });
    expect(prompt.messages[2]?.role).toBe("system");
    expect(prompt.messages[3]?.role).toBe("user");
  });

  it("does not mutate the conversation messages array", () => {
    const builder = new DefaultPromptBuilder();
    const messages = [{ role: "user" as const, content: "Q1?" }];
    const original: readonly typeof messages[number][] = [...messages];
    const prompt: Prompt = builder.build({
      query: "Q2?",
      context: makeContext([]),
      conversation: { messages },
    });
    expect(messages).toEqual(original);
    expect(prompt.messages).not.toBe(messages);
  });

  it("notes truncation when the context is truncated", () => {
    const builder = new DefaultPromptBuilder();
    const ctx = makeContext([makeChunk({ text: "a" })], { truncated: true });
    const prompt = builder.build({ query: "Q?", context: ctx });
    expect(prompt.messages[1]?.content).toContain("truncated");
  });
});
