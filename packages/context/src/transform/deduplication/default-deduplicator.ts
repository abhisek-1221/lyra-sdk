import type { ContextChunk } from "../../types/index.js";
import type { Deduplicator } from "../strategies.js";
import { ExactDeduplicator } from "./exact-deduplicator.js";
import { AdjacentMerger } from "./adjacent-merger.js";
import { NearDeduplicator } from "./near-deduplicator.js";

/**
 * The composite default. Runs cheap first, expensive last:
 *   1. `ExactDeduplicator` — O(n) by id+span.
 *   2. `AdjacentMerger` — O(n log n) sort + linear scan.
 *   3. `NearDeduplicator` — O(n²) cosine; only the survivors.
 *
 * The application can supply any single strategy or its own
 * chain. `DefaultDeduplicator` is what `DefaultContextBuilder`
 * uses by default.
 */
export class DefaultDeduplicator implements Deduplicator {
  public readonly name = "default";
  private readonly exact = new ExactDeduplicator();
  private readonly adjacent = new AdjacentMerger();
  private readonly near: NearDeduplicator;

  constructor(options: { nearThreshold?: number } = {}) {
    this.near = options.nearThreshold === undefined
      ? new NearDeduplicator()
      : new NearDeduplicator({ threshold: options.nearThreshold });
  }

  public deduplicate(chunks: readonly ContextChunk[]): readonly ContextChunk[] {
    let xs: readonly ContextChunk[] = this.exact.deduplicate(chunks);
    xs = this.adjacent.deduplicate(xs);
    xs = this.near.deduplicate(xs);
    return xs;
  }
}
