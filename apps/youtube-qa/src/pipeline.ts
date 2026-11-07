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
import {
  CharHeuristicTokenCounter,
  DefaultContextBuilder,
  TranscriptOrdering,
  TranscriptExpander,
} from "@lyra-sdk/context";
import { DefaultPromptBuilder } from "@lyra-sdk/prompt";
import { RetrievalPipeline } from "@lyra-sdk/pipeline";
import {
  RecursiveChunkStrategy,
  SpanChunkContentResolver,
  TranscriptParser,
  type YouTubeTranscriptLoader,
} from "@lyra-sdk/ingestion";
import type { Embedder } from "@lyra-sdk/embedding";

export function buildYoutubeQaPipeline(opts: {
  embedder: Embedder;
  generator: Generator;
  youtubeLoader?: YouTubeTranscriptLoader;
}) {
  const documents = new InMemoryDocumentRepository();
  const chunks = new InMemoryChunkRepository();
  const index = new BruteForceIndex(new CosineSimilarity());
  const retriever = new DenseRetriever({ index, embedder: opts.embedder, chunks });
  const resolver = new SpanChunkContentResolver(documents);
  const counter = new CharHeuristicTokenCounter();
  const promptBuilder = new DefaultPromptBuilder({ tokenCounter: counter });

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
      documents,
      chunkRepository: chunks,
      ordering: new TranscriptOrdering(),
      expander: new TranscriptExpander({ windowSeconds: 30 }),
      tokenCounter: counter,
    }),
    promptBuilder,
    generator: opts.generator,
    ...(opts.youtubeLoader !== undefined ? { youtubeLoader: opts.youtubeLoader } : {}),
  });
}

void OpenAIEmbedder;
void OpenAIGenerator;
