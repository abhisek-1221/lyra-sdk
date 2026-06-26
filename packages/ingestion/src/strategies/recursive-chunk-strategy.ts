import type { Chunk } from "@lyra-sdk/storage";
import { ChunkFactory, type ChunkFactoryOptions } from "../factory/chunk-factory.js";
import { GreedySpanMerger, type GreedySpanMergerOptions } from "../merge/greedy-span-merger.js";
import { TokenOverlapProcessor, type TokenOverlapProcessorOptions } from "../overlap/token-overlap-processor.js";
import { RecursiveSplitter, type RecursiveSplitterOptions } from "../segmentation/recursive-splitter.js";
import type { ChunkStrategy } from "../chunk-strategy.js";

/**
 * Options for {@link RecursiveChunkStrategy}.
 */
export interface RecursiveChunkStrategyOptions {
  readonly splitter?: RecursiveSplitterOptions;
  readonly merger?: GreedySpanMergerOptions;
  readonly overlap?: Omit<TokenOverlapProcessorOptions, "docLength">;
  readonly factory?: ChunkFactoryOptions;
}

/**
 * The recursive chunk strategy. Phase 1's only `ChunkStrategy`.
 *
 * Pipeline:
 *
 *   SourceDocument
 *     │  RecursiveSplitter.split(content)
 *     ▼
 *   TextSpan[]              // delimiter-aware, character-size target
 *     │  GreedySpanMerger.merge
 *     ▼
 *   TextSpan[]              // packed under chunkSize
 *     │  TokenOverlapProcessor.addOverlap
 *     ▼
 *   TextSpan[]              // sliding-window overlap
 *     │  ChunkFactory.create
 *     ▼
 *   Chunk[]                 // span-only, ids allocated
 *
 * The strategy is intentionally composable. The four stages can be
 * swapped individually (e.g. swap `RecursiveSplitter` for a future
 * `SemanticSplitter`) without changing the surrounding pipeline.
 */
export class RecursiveChunkStrategy implements ChunkStrategy {
  private readonly splitter: RecursiveSplitter;
  private readonly merger: GreedySpanMerger;
  private readonly overlap: number;
  private readonly factory: ChunkFactory;

  constructor(options: RecursiveChunkStrategyOptions = {}) {
    this.splitter = new RecursiveSplitter(options.splitter);
    this.merger = new GreedySpanMerger(options.merger);
    this.overlap = options.overlap?.overlap ?? 200;
    this.factory = new ChunkFactory(options.factory);
  }

  public async chunk(document: import("@lyra-sdk/storage").SourceDocument): Promise<readonly Chunk[]> {
    const raw = this.splitter.split(document.id, document.content);
    const packed = this.merger.merge(raw);
    const overlapProcessor = new TokenOverlapProcessor();
    const overlapped = overlapProcessor.addOverlap(packed, {
      overlap: this.overlap,
      docLength: document.content.length,
    });
    return this.factory.create(document.id, overlapped);
  }
}
