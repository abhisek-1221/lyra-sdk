import { KernelError } from "@lyra-sdk/kernel";
import type { JSONSchema } from "../contracts/prompt.js";

/**
 * Parse the response text as JSON when a `schema` is supplied.
 *
 * - If `schema` is `undefined`, the function returns `undefined`:
 *   the caller is not in structured-output mode and the response
 *   text is free-form.
 * - If `schema` is set and the text parses as JSON, the parsed
 *   value is returned.
 * - If `schema` is set and the text fails to parse, the function
 *   throws a `KernelError` with code `"internal"` (or a sub-error
 *   carrying the parse failure). The `BaseHttpGenerator` catches
 *   this and converts it into a `GenerationResponse` with
 *   `finishReason: "error"` and `diagnostics.parseError` set.
 *
 * The function does not validate the parsed value against `schema`
 * (no `ajv`). Validation is the caller's concern; Phase 4 only
 * forwards the schema to the provider's structured-output mode.
 */
export function parseJsonResponse<T>(
  text: string,
  schema: JSONSchema | undefined,
): T | undefined {
  if (schema === undefined) return undefined;
  try {
    return JSON.parse(text) as T;
  } catch (err) {
    throw new KernelError(
      "internal",
      `Failed to parse structured response: ${String(err)}`,
      { cause: err },
    );
  }
}
