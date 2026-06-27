import type { GenerationResponse } from "@lyra-sdk/generation";
import type { Prompt } from "@lyra-sdk/prompt";
import type { PipelineResult } from "./pipeline-result.js";

/**
 * The result of a `RetrievalPipeline.ask` call. Holds the
 * unchanged Phase 3 `PipelineResult`, the assembled `Prompt`,
 * and the `GenerationResponse` from the LLM.
 *
 * `askResult.generation.citations` is a copy of
 * `askResult.pipeline.context.citations`, populated by the
 * pipeline at the `ask` seam. The application can read either
 * field and get the same array.
 *
 * `Prompt` does **not** carry citations; the prompt builder
 * emits citation markers (`[1]`, `[2]`, …) inline in the
 * rendered chunk text. The application renders a matching
 * footer from `askResult.generation.citations`.
 */
export interface AskResult<T = unknown> {
  readonly pipeline: PipelineResult;
  readonly prompt: Prompt;
  readonly generation: GenerationResponse<T>;
}
