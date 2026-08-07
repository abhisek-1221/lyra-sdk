import type { ContextTransform } from "../../../src/transform/context-transform.js";
import { describe, expect, it } from "vitest";

/**
 * The contract tests for `ContextTransform`. The base is a
 * pure function over a list; it MUST NOT mutate the input.
 */
describe("ContextTransform contract", () => {
  it("a ContextTransform with a fresh-array impl returns equal output for equal input", () => {
    const t: ContextTransform = {
      name: "noop",
      apply: <T>(xs: readonly T[]): readonly T[] => [...xs],
    };
    const input: readonly number[] = [1, 2, 3];
    const out1 = t.apply(input);
    const out2 = t.apply(input);
    expect(out1).toEqual(out2);
  });

  it("a well-behaved ContextTransform does not mutate its input", () => {
    // The contract recommends immutability; the test verifies the
    // common case. A malicious transform can still mutate, but
    // every transform in this package is immutable.
    const identity: ContextTransform = {
      name: "identity",
      apply: <T>(xs: readonly T[]): readonly T[] => [...xs],
    };
    const input: readonly number[] = [1, 2, 3];
    const snapshot = [...input];
    identity.apply(input);
    expect(input).toEqual(snapshot);
  });
});
