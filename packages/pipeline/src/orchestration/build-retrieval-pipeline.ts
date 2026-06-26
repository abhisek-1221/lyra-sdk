import { SpanChunkContentResolver, type ChunkStrategy, type SourceParser } from "@lyra-sdk/ingestion";
import { DenseRetriever } from "@lyra-sdk/retrieval";
import type { Embedder } from "@lyra-sdk/embedding";
import type { VectorIndex } from "@lyra-sdk/index";
import type { Retriever } from "@lyra-sdk/retrieval";
import type { ChunkRepository, DocumentRepository } from "@lyra-sdk/storage";
import { KernelError } from "@lyra-sdk/kernel";
import { RetrievalPipeline } from "./retrieval-pipeline.js";
import type { RetrievalPipelineBuilder } from "../builder/retrieval-pipeline-builder.js";

/**
 * Validates the builder's required fields and constructs a
 * `RetrievalPipeline`. Single seam between the fluent builder and
 * the runtime class.
 */
export function buildRetrievalPipeline(b: RetrievalPipelineBuilder): RetrievalPipeline {
  if (!b._sourceParser) {
    throw new KernelError("invalid_argument", "RetrievalPipelineBuilder: withParser is required");
  }
  if (!b._segmenter) {
    throw new KernelError("invalid_argument", "RetrievalPipelineBuilder: withChunkStrategy is required");
  }
  if (!b._embedder) {
    throw new KernelError("invalid_argument", "RetrievalPipelineBuilder: withEmbedder is required");
  }
  if (!b._chunks) {
    throw new KernelError("invalid_argument", "RetrievalPipelineBuilder: withChunkRepository is required");
  }
  if (!b._documents) {
    throw new KernelError("invalid_argument", "RetrievalPipelineBuilder: withDocumentRepository is required");
  }
  if (!b._index) {
    throw new KernelError("invalid_argument", "RetrievalPipelineBuilder: withIndex is required");
  }

  return new RetrievalPipeline({
    sourceParser: b._sourceParser as SourceParser<unknown>,
    segmenter: b._segmenter as ChunkStrategy,
    embedder: b._embedder as Embedder,
    chunks: b._chunks as ChunkRepository,
    documents: b._documents as DocumentRepository,
    index: b._index as VectorIndex,
    contentResolver: b._contentResolver ?? new SpanChunkContentResolver(b._documents),
    retriever: b._retriever ?? defaultRetriever(b._index, b._embedder, b._chunks),
  });
}

function defaultRetriever(
  index: VectorIndex | undefined,
  embedder: Embedder | undefined,
  chunks: ChunkRepository | undefined,
): Retriever {
  if (!index || !embedder || !chunks) {
    throw new KernelError("internal", "defaultRetriever: missing required dependency");
  }
  return new DenseRetriever({ index, embedder, chunks });
}
