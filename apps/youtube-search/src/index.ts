/**
 * The youtube-search example. Given a YouTube URL, ingest the
 * transcript and print the candidate segments for a query.
 *
 * Usage:
 *   pnpm --filter youtube-search dev -- "https://youtu.be/..." "What is the question?"
 *
 * Smoke tests exercise the same flow with stubs.
 */
import { BruteForceIndex, CosineSimilarity } from "@lyra-sdk/index";
import { InMemoryChunkRepository, InMemoryDocumentRepository } from "@lyra-sdk/storage";
import { OpenAIEmbedder } from "@lyra-sdk/embedding";
import { DenseRetriever } from "@lyra-sdk/retrieval";
import { RetrievalPipeline } from "@lyra-sdk/pipeline";
import {
  CoreYouTubeTranscriptLoader,
  RecursiveChunkStrategy,
  SpanChunkContentResolver,
  TranscriptParser,
} from "@lyra-sdk/ingestion";

export async function main(youtubeUrl: string, query: string) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    console.error("OPENAI_API_KEY is required");
    process.exit(1);
  }

  const documents = new InMemoryDocumentRepository();
  const chunks = new InMemoryChunkRepository();
  const index = new BruteForceIndex(new CosineSimilarity());
  const embedder = new OpenAIEmbedder({ apiKey });
  const parser = new TranscriptParser();
  const segmenter = new RecursiveChunkStrategy();
  const retriever = new DenseRetriever({ index, embedder, chunks });

  const pipeline = new RetrievalPipeline({
    sourceParser: parser,
    segmenter,
    embedder,
    chunks,
    documents,
    index,
    contentResolver: new SpanChunkContentResolver(documents),
    retriever,
  });

  const loader = new CoreYouTubeTranscriptLoader();
  const transcript = await loader.load({ url: youtubeUrl });
  await pipeline.ingest(transcript);
  const result = await pipeline.query(query, 5);
  for (const r of result.reranked) {
    console.log(`[${r.score.toFixed(3)}] ${r.chunk.documentId}`);
  }
  pipeline.dispose();
}

if (process.argv[1]?.endsWith("index.ts") || process.argv[1]?.endsWith("index.js")) {
  const [, , url, query] = process.argv;
  if (url && query) main(url, query).catch((err) => { console.error(err); process.exit(1); });
}
