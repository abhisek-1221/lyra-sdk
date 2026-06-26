import type { ScoredChunk } from "@lyra-sdk/retrieval";
import type { RerankResult, RerankerOptions } from "../contracts/index.js";
import type { Reranker } from "../contracts/reranker.js";

/**
 * Options for {@link CascadeReranker}.
 *
 * `stages` is the ordered list of `Reranker` instances to apply in
 * sequence. The output of stage `i` becomes the input to stage
 * `i+1`. The canonical pattern is
 *
 *   `MMRReranker(...) -> JinaReranker(...)`
 *
 * where MMR cheaply drops redundant candidates before the
 * expensive cross-encoder inference runs.
 *
 * `passTexts` controls whether the per-call `options.texts` is
 * forwarded to downstream stages. Cross-encoder rerankers need
 * the texts; MMR and threshold filters do not. The cascade
 * forwards `options.texts` only if `passTexts` is true AND the
 * downstream stage's `rerank` consumes the field. In Phase 3
 * the default is `passTexts: true` because the typical cascade
 * is MMR -> cross-encoder, and the cross-encoder needs the texts.
 * The application is responsible for slicing `texts` to match
 * the candidates that survive the previous stage — the cascade
 * does not slice for you (it would have to know which candidates
 * were dropped, which is an opaque detail of the upstream stage).
 *
 * For the MMR -> cross-encoder pattern, the recommended approach
 * is: run MMR first, then resolve the texts for the surviving
 * candidates, then run the cross-encoder in a second `pipeline.query`
 * or via a `CascadeReranker` that knows the slice. The simplest
 * pattern is two explicit calls; the cascade is a convenience for
 * pure ranking (no text needed), e.g. MMR -> threshold filter.
 */
export interface CascadeRerankerOptions extends RerankerOptions {
  readonly stages: readonly Reranker[];
  /**
   * Forward `options.texts` to downstream stages. Default: false.
   * The cascade does NOT slice `texts` for you; if the previous
   * stage dropped candidates, the texts and the candidates will
   * be out of sync. For text-needing cascades, prefer two
   * explicit `rerank` calls.
   */
  readonly passTexts?: boolean;
}

/**
 * A `CascadeReranker` composes a list of `Reranker` stages. Each
 * stage consumes the previous stage's output. The cascade is
 * itself a `Reranker`, so it can be plugged into the pipeline
 * alongside any other reranker.
 *
 * Diagnostics carry per-stage output sizes and durations so a
 * benchmark can plot the latency-vs-size frontier.
 */
export class CascadeReranker implements Reranker {
  public readonly name: string;
  private readonly stages: readonly Reranker[];
  private readonly passTexts: boolean;

  constructor(options: CascadeRerankerOptions) {
    if (options.stages.length === 0) {
      throw new Error("CascadeReranker: stages must be non-empty");
    }
    this.stages = options.stages;
    this.passTexts = options.passTexts ?? false;
    this.name = options.name ?? `cascade-${options.stages.map((s) => s.name).join("->")}`;
  }

  public async rerank(
    query: string,
    candidates: readonly ScoredChunk[],
    options?: RerankerOptions,
  ): Promise<RerankResult> {
    const start = Date.now();
    let current: readonly ScoredChunk[] = candidates;
    const perStage: Record<string, { size: number; durationMs: number }> = {};
    for (const stage of this.stages) {
      // If passTexts is enabled and options.texts is the same
      // length as the current candidates, forward it. Otherwise
      // pass options through unchanged.
      let stageOptions: RerankerOptions | undefined = options;
      if (this.passTexts && options?.texts !== undefined) {
        if (options.texts.length === current.length) {
          stageOptions = options;
        } else if (options.name !== undefined) {
          // Length mismatch after a previous stage; forward the
          // call options without `texts` so the cross-encoder
          // stage throws a clear error.
          stageOptions = { name: options.name };
        } else {
          stageOptions = undefined;
        }
      }
      const out = await stage.rerank(query, current, stageOptions);
      perStage[stage.name] = { size: out.results.length, durationMs: out.durationMs };
      current = out.results;
    }
    return {
      results: current,
      durationMs: Date.now() - start,
      diagnostics: { perStage, stages: this.stages.length },
    };
  }
}
