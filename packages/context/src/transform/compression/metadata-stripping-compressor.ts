import type { ContextChunk } from "../../types/index.js";
import type { Compressor } from "../strategies.js";

/**
 * Strips optional fields from each chunk, keeping only the
 * minimum the LLM prompt needs: `text`, `score`, `citation`,
 * and the join keys. Always safe; runs in the default chain.
 */
export class MetadataStrippingCompressor implements Compressor {
  public readonly name = "metadata-stripping";

  public compress(chunks: readonly ContextChunk[]): readonly ContextChunk[] {
    return chunks.map((c) => ({
      chunkId: c.chunkId,
      documentId: c.documentId,
      text: c.text,
      score: c.score,
      span: c.span,
      citation: c.citation,
    }));
  }
}
