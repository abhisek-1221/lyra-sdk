import type { ContextChunk } from "../../types/index.js";
import type { DeduplicateContext, Deduplicator } from "../strategies.js";
import { ExactDeduplicator } from "./exact-deduplicator.js";
import { AdjacentMerger } from "./adjacent-merger.js";
import { NearDeduplicator } from "./near-deduplicator.js";

/**
 * The composite default. Cheap and vector-faithful passes run
 * before span merging:
 *   1. `ExactDeduplicator` — O(n) by document, id, and span.
 *   2. `NearDeduplicator` — O(n²) cosine on the original embeddings.
 *   3. `AdjacentMerger` — overlap and touching spans, re-sliced.
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
    this.near =
      options.nearThreshold === undefined
        ? new NearDeduplicator()
        : new NearDeduplicator({ threshold: options.nearThreshold });
  }

  public async deduplicate(
    chunks: readonly ContextChunk[],
    ctx?: DeduplicateContext,
  ): Promise<readonly ContextChunk[]> {
    let xs = await this.exact.deduplicate(chunks);
    xs = await this.near.deduplicate(xs);
    xs = await this.adjacent.deduplicate(xs, ctx);
    return xs;
  }
}
