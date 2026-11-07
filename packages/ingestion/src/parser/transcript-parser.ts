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
 *     offset (seconds), duration, language, and the line's
 *     `contentStart` / `contentEnd` offsets into `content`.
 *     Downstream chunking copies `offset` onto chunk timestamps.
 *   - `metadata` carries the video's own metadata for retrieval-time
 *     filtering and citation display, including a watch `url`.
 */
export class TranscriptParser implements SourceParser<TranscriptWithMetaMirror> {
  public parse(input: TranscriptWithMetaMirror): SourceDocument {
    const lines = input.lines;
    const content = lines.map((l) => l.text).join("\n");

    const blocks: DocumentBlock[] = [];
    let cursor = 0;
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i]!;
      const contentStart = cursor;
      const contentEnd = cursor + line.text.length;
      blocks.push({
        text: line.text,
        metadata: {
          offset: line.offset,
          duration: line.duration,
          lang: line.lang,
          lineIndex: i,
          contentStart,
          contentEnd,
        },
      });
      cursor = contentEnd;
      if (i < lines.length - 1) cursor += 1;
    }

    const m = input.meta;
    const metadata: Record<string, string | number | boolean> = {
      videoId: m.videoId,
      title: m.title,
      author: m.author,
      channelId: m.channelId,
      lengthSeconds: m.lengthSeconds,
      viewCount: m.viewCount,
      isLiveContent: m.isLiveContent,
      url: `https://www.youtube.com/watch?v=${m.videoId}`,
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
