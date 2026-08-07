import type { Chunk } from "@lyra-sdk/storage";
import type { SourceDocument } from "@lyra-sdk/storage";

/**
 * A `ChunkStrategy` is the orchestrator that turns a `SourceDocument`
 * into a list of `Chunk`s. Strategies compose the splitter, the
 * merger, the overlap processor, and the chunk factory in some order.
 */
export interface ChunkStrategy {
  chunk(document: SourceDocument): Promise<readonly Chunk[]>;
}
