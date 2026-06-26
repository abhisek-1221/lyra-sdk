/**
 * @lyra-sdk/context
 *
 * Context construction from reranked chunks. Phase 3 of the
 * RAG plan.
 *
 * The package is a pure consumer of `ScoredChunk` and
 * `SourceDocument`. It produces a prompt-ready `Context`:
 * resolved text, ordered, deduplicated, budget-respecting, and
 * citation-preserving.
 *
 * Architecture:
 *   - `Context` and `ContextChunk` are deeply `readonly`.
 *   - `ContextTransform` is the unified base for every pure
 *     transformation: `ContextOrdering`, `Deduplicator`,
 *     `Compressor`, `Expander`.
 *   - `DefaultContextBuilder` chains them in a fixed order
 *     with sensible transcript-friendly defaults.
 *
 * The application is responsible for choosing strategies.
 *
 * @packageDocumentation
 */

export type { Context, ContextChunk, ContextCitation } from "./types/index.js";
export { makeCitationKey } from "./types/index.js";

export type { ContextBuilder } from "./builder/index.js";
export type { ContextBuilderOptions } from "./builder/index.js";
export { DefaultContextBuilder, InMemoryChunkContentResolver } from "./builder/index.js";

export type { ContextTransform } from "./transform/context-transform.js";

export type { ContextOrdering } from "./transform/strategies.js";
export { ScoreOrdering, SourceOrderOrdering, ChronologicalOrdering, TimestampOrdering, TranscriptOrdering } from "./transform/ordering/index.js";

export type { Deduplicator } from "./transform/strategies.js";
export { ExactDeduplicator, AdjacentMerger, NearDeduplicator, DefaultDeduplicator } from "./transform/deduplication/index.js";

export type { Compressor } from "./transform/strategies.js";
export { MetadataStrippingCompressor, HeadTruncatingCompressor, CenterTruncatingCompressor } from "./transform/compression/index.js";

export type { Expander } from "./transform/strategies.js";
export { IdentityExpander, TranscriptExpander } from "./transform/expansion/index.js";
export type { TranscriptExpanderOptions } from "./transform/expansion/index.js";

export type { TokenCounter, TokenBudget } from "./transform/budgeting/index.js";
export { CharHeuristicTokenCounter, makeTokenBudget, BudgetAllocator } from "./transform/budgeting/index.js";

export { makeCitation, dedupeCitations } from "./citations/index.js";
