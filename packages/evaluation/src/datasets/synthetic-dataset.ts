import type { ChunkId } from "@lyra-sdk/kernel";
import type { RetrievalDataset, RetrievalExample } from "./retrieval-dataset.js";

/**
 * Options for {@link SyntheticDataset}.
 */
export interface SyntheticDatasetOptions {
  readonly name: string;
  /**
   * A function that, given an integer index, returns the
   * example to use. The benchmark calls this with `0`, `1`,
   * `2`, ..., `size - 1`.
   */
  readonly generate: (index: number) => RetrievalExample;
  readonly size: number;
}

/**
 * A programmatically generated dataset. The generator is
 * called once per example at construction time so the dataset
 * is materialized (and the same `examples` array can be
 * inspected, logged, and reused across runs).
 */
export class SyntheticDataset implements RetrievalDataset {
  public readonly name: string;
  public readonly examples: readonly RetrievalExample[];

  constructor(options: SyntheticDatasetOptions) {
    this.name = options.name;
    const out: RetrievalExample[] = [];
    for (let i = 0; i < options.size; i++) {
      out.push(options.generate(i));
    }
    this.examples = out;
  }
}

/**
 * Helper: a no-op synthetic generator. Useful for
 * smoke-testing the benchmark runner without a real
 * generator.
 */
export function constantExample(query: string, relevant: readonly ChunkId[] = []): (i: number) => RetrievalExample {
  return () => ({ query, relevant });
}
