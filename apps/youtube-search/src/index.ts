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
import { SpanChunkContentResolver, type SourceParser, type TranscriptWithMetaMirror } from "@lyra-sdk/ingestion";
import { createDocumentId } from "@lyra-sdk/kernel";

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
  const parser: SourceParser<TranscriptWithMetaMirror> = transcriptParser();
  const segmenter = transcriptSegmenter();
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

  // The application supplies a real `YouTubeTranscriptLoader`
  // (e.g. via `youtube-transcript` or `yt-dlp`). For brevity
  // the example REPL is wired to a static transcript; a real
  // ingestion path would call `loader.load(url)`.
  const transcript: TranscriptWithMetaMirror = {
    meta: { videoId: youtubeUrl as never, title: "T", author: "A", channelId: "UC", lengthSeconds: 0, viewCount: 0, description: "", keywords: [], thumbnails: [], isLiveContent: false },
    lines: [
      { text: "the rain in spain falls mainly on the plain", duration: 1, offset: 0, lang: "en" },
    ],
  };
  await pipeline.ingest(transcript);
  const result = await pipeline.query(query, 5);
  for (const r of result.reranked) {
    console.log(`[${r.score.toFixed(3)}] ${r.chunk.documentId}`);
  }
  pipeline.dispose();
}

function transcriptSegmenter(): import("@lyra-sdk/ingestion").ChunkStrategy {
  return {
    async chunk(document) {
      const out = [];
      let cursor = 0;
      for (const block of document.blocks) {
        const start = cursor;
        const end = cursor + block.text.length;
        out.push({
          id: `${document.id}-${start}` as never,
          documentId: createDocumentId(document.id),
          span: { sourceId: document.id, start, end },
          metadata: {},
        });
        cursor = end;
      }
      return out;
    },
  };
}

function transcriptParser(): SourceParser<TranscriptWithMetaMirror> {
  return {
    parse(input: TranscriptWithMetaMirror) {
      return {
        id: createDocumentId(input.meta.videoId),
        sourceUri: `youtube:${input.meta.videoId}`,
        content: input.lines.map((l) => l.text).join(" "),
        blocks: input.lines.map((l) => ({ text: l.text, metadata: {} })),
        metadata: { videoId: input.meta.videoId },
      };
    },
  };
}

if (process.argv[1]?.endsWith("index.ts") || process.argv[1]?.endsWith("index.js")) {
  const [, , url, query] = process.argv;
  if (url && query) main(url, query).catch((err) => { console.error(err); process.exit(1); });
}
