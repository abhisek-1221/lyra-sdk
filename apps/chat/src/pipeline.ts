import { BruteForceIndex, CosineSimilarity } from "@lyra-sdk/index";
import { InMemoryChunkRepository, InMemoryDocumentRepository } from "@lyra-sdk/storage";
import { type Generator } from "@lyra-sdk/generation";
import { DefaultPromptBuilder } from "@lyra-sdk/prompt";
import { RetrievalPipeline } from "@lyra-sdk/pipeline";
import type { Embedder } from "@lyra-sdk/embedding";
import type { ChunkStrategy, SourceParser, TranscriptWithMetaMirror } from "@lyra-sdk/ingestion";
import { SpanChunkContentResolver } from "@lyra-sdk/ingestion";
import { createDocumentId } from "@lyra-sdk/kernel";

/**
 * Build a `RetrievalPipeline` configured for the chat example.
 * The application injects the embedder and generator; the
 * pipeline does not own them.
 *
 * The chat example uses a `DefaultPromptBuilder` (the
 * default) and a `DefaultContextBuilder` is left unconfigured
 * (the prompt builder works with an empty `Context` for the
 * first question, and the application's stubs populate the
 * `Context` for subsequent turns).
 */
export function buildChatPipeline(opts: { embedder: Embedder; generator: Generator }) {
  const documents = new InMemoryDocumentRepository();
  const chunks = new InMemoryChunkRepository();
  const index = new BruteForceIndex(new CosineSimilarity());
  const parser: SourceParser<TranscriptWithMetaMirror> = transcriptParser();
  const segmenter: ChunkStrategy = transcriptSegmenter();
  // A stub retriever that returns no results. The chat
  // example's purpose is to demonstrate the `Conversation`
  // hook; retrieval is incidental and a real application
  // would supply a `DenseRetriever` or `HybridRetriever`.
  const retriever = {
    async retrieve(query: string) {
      return { query, results: [], durationMs: 0 };
    },
  };

  return new RetrievalPipeline({
    sourceParser: parser,
    segmenter,
    embedder: opts.embedder,
    chunks,
    documents,
    index,
    contentResolver: new SpanChunkContentResolver(documents),
    retriever,
    promptBuilder: new DefaultPromptBuilder(),
    generator: opts.generator,
  });
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

function transcriptSegmenter(): ChunkStrategy {
  return {
    async chunk(document) {
      const out = [];
      let cursor = 0;
      for (const block of document.blocks) {
        const start = cursor;
        const end = cursor + block.text.length;
        out.push({
          id: `${document.id}-${start}` as never,
          documentId: document.id,
          span: { sourceId: document.id, start, end },
          metadata: {},
        });
        cursor = end;
      }
      return out;
    },
  };
}
