/**
 * The youtube-qa example. Builds a full RAG pipeline
 * (retriever → reranker → context builder → prompt builder →
 * generator) and exposes a single `ask` function.
 *
 * Smoke tests exercise the same flow with stubs.
 */
import { BruteForceIndex, CosineSimilarity } from "@lyra-sdk/index";
import { InMemoryChunkRepository, InMemoryDocumentRepository } from "@lyra-sdk/storage";
import { DenseRetriever } from "@lyra-sdk/retrieval";
import { OpenAIEmbedder } from "@lyra-sdk/embedding";
import { OpenAIGenerator, type Generator } from "@lyra-sdk/generation";
import { DefaultContextBuilder, TranscriptOrdering, TranscriptExpander } from "@lyra-sdk/context";
import { DefaultPromptBuilder } from "@lyra-sdk/prompt";
import { RetrievalPipeline } from "@lyra-sdk/pipeline";
import { RecursiveChunkStrategy, SpanChunkContentResolver, TranscriptParser } from "@lyra-sdk/ingestion";
import type { Embedder } from "@lyra-sdk/embedding";

export function buildYoutubeQaPipeline(opts: { embedder: Embedder; generator: Generator }) {
  const documents = new InMemoryDocumentRepository();
  const chunks = new InMemoryChunkRepository();
  const index = new BruteForceIndex(new CosineSimilarity());
  const retriever = new DenseRetriever({ index, embedder: opts.embedder, chunks });
  const resolver = new SpanChunkContentResolver(documents);

  return new RetrievalPipeline({
    sourceParser: new TranscriptParser(),
    segmenter: new RecursiveChunkStrategy(),
    embedder: opts.embedder,
    chunks,
    documents,
    index,
    contentResolver: resolver,
    retriever,
    contextBuilder: new DefaultContextBuilder({
      tokenBudget: 4000,
      resolver,
      ordering: new TranscriptOrdering(),
      expander: new TranscriptExpander(),
    }),
    promptBuilder: new DefaultPromptBuilder(),
    generator: opts.generator,
  });
}

void OpenAIEmbedder;
void OpenAIGenerator;
