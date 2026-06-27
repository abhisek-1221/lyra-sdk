/**
 * The `GenerationRequest` carries a pre-built `Prompt` to the
 * generator. The pipeline uses `@lyra-sdk/prompt`'s
 * `DefaultPromptBuilder` to build one from a `Context`, but
 * applications are free to build their own.
 *
 * The request carries no citations; citations are metadata that
 * lives on `Context` and on `GenerationResponse`. The pipeline is
 * the single seam that lifts `Context.citations` onto the response.
 */
import type { Prompt } from "./prompt.js";

export interface GenerationRequest {
  /** A pre-built prompt. */
  readonly prompt: Prompt;
}
