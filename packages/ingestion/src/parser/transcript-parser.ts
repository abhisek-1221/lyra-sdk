import { createDocumentId } from "@lyra-sdk/kernel";
import type { DocumentBlock, SourceDocument } from "@lyra-sdk/storage";
import type { SourceParser } from "./source-parser.js";
import type { TranscriptWithMetaMirror } from "./transcript-mirror.js";

/**
 * The YouTube transcript parser. Phase 1's only `SourceParser`
 * implementation.
 *
 * Materializes a `SourceDocument` from a `TranscriptWithMeta`-shaped
 * input (structurally compatible with `lyra-sdk`'s `TranscriptWithMeta`).
 *
 * Strategy:
 *   - `content` is the join of all line texts with `\n`. Joining is
 *     deterministic and matches the slice math in
 *     `SpanChunkContentResolver`.
 *   - `blocks` mirrors each transcript line, with the line index,
 *     offset, duration, and language carried in `metadata`. Downstream
 *     consumers (chunker, citation builder) can use these to respect
 *     caption boundaries without re-parsing the input.
 *   - `metadata` carries the video's own metadata for retrieval-time
 *     filtering and citation display.
 */
export class TranscriptParser implements SourceParser<TranscriptWithMetaMirror> {
  public parse(input: TranscriptWithMetaMirror): SourceDocument {
    const lines = input.lines;
    const content = lines.map((l) => l.text).join("\n");

    const blocks: DocumentBlock[] = lines.map((line, i) => ({
      text: line.text,
      metadata: {
        offset: line.offset,
        duration: line.duration,
        lang: line.lang,
        lineIndex: i,
      },
    }));

    const m = input.meta;
    const metadata: Record<string, string | number | boolean> = {
      videoId: m.videoId,
      title: m.title,
      author: m.author,
      channelId: m.channelId,
      lengthSeconds: m.lengthSeconds,
      viewCount: m.viewCount,
      isLiveContent: m.isLiveContent,
    };

    return {
      id: createDocumentId(m.videoId),
      sourceUri: `youtube:${m.videoId}`,
      content,
      blocks,
      metadata,
    };
  }
}
