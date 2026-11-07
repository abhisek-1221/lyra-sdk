import type { ContextChunk } from "../../types/index.js";
import type { Compressor } from "../strategies.js";

/**
 * Drops fields the prompt does not render: the embedding and the
 * raw metadata bag. Keeps `timestamp` and `speaker` so transcript
 * headers survive. Always safe; runs in the default chain.
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
      ...(c.anchor !== undefined ? { anchor: c.anchor } : {}),
      citation: c.citation,
      ...(c.timestamp !== undefined ? { timestamp: c.timestamp } : {}),
      ...(c.speaker !== undefined ? { speaker: c.speaker } : {}),
      ...(c.mergedCitations !== undefined ? { mergedCitations: c.mergedCitations } : {}),
    }));
  }
}
