import type { ContextChunk } from "../../types/index.js";
import type { Expander } from "../strategies.js";

/**
 * The default expander: identity. Returns the input unchanged.
 * Pure-text applications that don't want a transcript expander
 * explicitly pass `IdentityExpander`.
 */
export class IdentityExpander implements Expander {
  public readonly name = "identity";

  public async expand(chunks: readonly ContextChunk[]): Promise<readonly ContextChunk[]> {
    return chunks;
  }
}
