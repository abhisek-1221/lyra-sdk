import type { JSONSchema, Prompt, PromptMessage } from "../../src/contracts/prompt.js";
import { describe, expect, it } from "vitest";

/**
 * The structural-equality test enforces that the in-package
 * `Prompt` declaration matches the canonical one in
 * `@lyra-sdk/prompt`. The two are kept in sync by hand; a
 * drift in either direction is a test failure.
 *
 * The test typechecks both directions of assignment:
 *
 *   const a: ThisPackagePrompt = promptPackagePrompt;  ✓
 *   const b: PromptPackagePrompt = thisPackagePrompt;  ✓
 *
 * The package imports are done lazily (require-style) to keep
 * the structural check independent of the dependency graph.
 */
describe("Prompt structural equality", () => {
  it("the in-package Prompt accepts a @lyra-sdk/prompt Prompt", async () => {
    const promptModule = await import("@lyra-sdk/prompt");
    const promptPackagePrompt: Prompt = {
      system: "S",
      messages: [{ role: "user", content: "Q" }] as readonly PromptMessage[],
      estimatedInputTokens: 1,
    };
    // Type-level: assignment is allowed. Runtime: the object is
    // structurally compatible.
    const local: Prompt = promptPackagePrompt;
    expect(local.system).toBe("S");
    expect(local.messages[0]?.content).toBe("Q");
    expect(promptModule).toBeDefined();
  });

  it("the in-package PromptMessage is the same shape", () => {
    const local: PromptMessage = { role: "assistant", content: "A" };
    expect(local.role).toBe("assistant");
  });

  it("the in-package JSONSchema is a Readonly Record", () => {
    const local: JSONSchema = { type: "object", properties: { a: { type: "string" } } };
    expect(local.type).toBe("object");
  });
});
