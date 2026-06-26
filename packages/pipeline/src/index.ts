/**
 * @lyra-sdk/pipeline
 *
 * Builder, runtime, and orchestration for the Lyra retrieval
 * pipeline. Wires parser → chunker → resolver → embedder → index;
 * the retriever is query-only and composed at the boundary.
 *
 * The pipeline is the public surface of the RAG layer. Callers
 * configure it via the fluent builder and call `ingest` / `query`.
 *
 * Contents:
 *   - `RetrievalPipelineBuilder` — fluent builder
 *   - `RetrievalPipeline` — runtime facade (ingest, query, dispose)
 *   - `RetrievalRuntime` — owns the ingest chain
 *   - `RetrievalPipelineDeps` — frozen dependency bag
 *
 * @packageDocumentation
 */

export { RetrievalPipelineBuilder } from "./builder/retrieval-pipeline-builder.js";
export { RetrievalPipeline, type RetrievalPipelineDeps, type Chunk } from "./orchestration/retrieval-pipeline.js";
export { type PipelineResult } from "./orchestration/pipeline-result.js";
export { RetrievalRuntime } from "./runtime/retrieval-runtime.js";
