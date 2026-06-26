/**
 * @lyra-sdk/ingestion
 *
 * Source parsers, chunk strategies, and the default chunk content
 * resolver. Phase 1 ships a transcript parser, the recursive chunk
 * strategy, and a span-based content resolver.
 *
 * Depends on `@lyra-sdk/kernel` and `@lyra-sdk/storage`. Treats
 * `lyra-sdk` as an optional peer dependency — the package builds and
 * runs without it; the transcript parser consumes a structural mirror
 * of `lyra-sdk`'s `TranscriptWithMeta` so any value that satisfies
 * `lyra-sdk`'s real type is accepted.
 *
 * Contents:
 *   - `SourceParser<T>`, `TranscriptParser` — `TranscriptWithMeta` → `SourceDocument`
 *   - `RecursiveSplitter`, `GreedySpanMerger`, `TokenOverlapProcessor`, `ChunkFactory` — pipeline stages
 *   - `ChunkStrategy`, `RecursiveChunkStrategy` — orchestrator
 *   - `ChunkContentResolver`, `SpanChunkContentResolver` — on-demand text materialization
 *
 * @packageDocumentation
 */

export type { SourceParser } from "./parser/source-parser.js";
export type {
  TranscriptLineMirror,
  VideoMetaMirror,
  TranscriptWithMetaMirror,
} from "./parser/transcript-mirror.js";
export { TranscriptParser } from "./parser/transcript-parser.js";

export type { ChunkStrategy } from "./chunk-strategy.js";
export type { ChunkContentResolver } from "./chunk-content-resolver.js";

export type {
  RecursiveSplitterOptions,
} from "./segmentation/recursive-splitter.js";
export { RecursiveSplitter, DEFAULT_SEPARATORS } from "./segmentation/recursive-splitter.js";

export type { GreedySpanMergerOptions } from "./merge/greedy-span-merger.js";
export { GreedySpanMerger } from "./merge/greedy-span-merger.js";

export type { TokenOverlapProcessorOptions } from "./overlap/token-overlap-processor.js";
export { TokenOverlapProcessor } from "./overlap/token-overlap-processor.js";

export type { ChunkFactoryOptions } from "./factory/chunk-factory.js";
export { ChunkFactory } from "./factory/chunk-factory.js";

export { SpanChunkContentResolver } from "./factory/span-chunk-content-resolver.js";

export type { RecursiveChunkStrategyOptions } from "./strategies/recursive-chunk-strategy.js";
export { RecursiveChunkStrategy } from "./strategies/recursive-chunk-strategy.js";
