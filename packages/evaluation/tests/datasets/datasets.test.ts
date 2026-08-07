import { createChunkId } from "@lyra-sdk/kernel";
import { describe, expect, it } from "vitest";
import { GoldenDataset } from "../../src/datasets/golden-dataset.js";
import { SyntheticDataset, constantExample } from "../../src/datasets/synthetic-dataset.js";

describe("GoldenDataset", () => {
  it("stores the name and examples", () => {
    const examples = [{ query: "q1", relevant: [createChunkId("a")] as readonly never[] }];
    const ds = new GoldenDataset({ name: "test", examples });
    expect(ds.name).toBe("test");
    expect(ds.examples.length).toBe(1);
  });
});

describe("SyntheticDataset", () => {
  it("generates the requested number of examples", () => {
    const ds = new SyntheticDataset({
      name: "synth",
      generate: constantExample("q"),
      size: 5,
    });
    expect(ds.examples.length).toBe(5);
  });

  it("uses the generator", () => {
    const ds = new SyntheticDataset({
      name: "synth",
      generate: (i) => ({ query: `q${i}`, relevant: [] }),
      size: 3,
    });
    expect(ds.examples[0]?.query).toBe("q0");
    expect(ds.examples[2]?.query).toBe("q2");
  });
});

describe("constantExample", () => {
  it("returns the same example for any index", () => {
    const gen = constantExample("hello");
    expect(gen(0)).toEqual({ query: "hello", relevant: [] });
    expect(gen(99)).toEqual({ query: "hello", relevant: [] });
  });
});
