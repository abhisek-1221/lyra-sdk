import type { SourceDocument } from "@lyra-sdk/storage";
import { TranscriptParser } from "../transcript-parser.js";
import type { YouTubeInput } from "./youtube-input.js";
import type { YouTubeTranscriptLoader, YouTubeTranscriptLoadOptions } from "./youtube-transcript-loader.js";

/**
 * Convenience wrapper that composes:
 * - async transcript acquisition (`YouTubeTranscriptLoader`)
 * - sync mapping to `SourceDocument` (`TranscriptParser`)
 *
 * Note: this is intentionally NOT a `SourceParser<T>` because the
 * pipeline's `SourceParser` is synchronous.
 */
export class YouTubeTranscriptSourceParser {
  private readonly loader: YouTubeTranscriptLoader;
  private readonly parser: TranscriptParser;

  constructor(deps: { readonly loader: YouTubeTranscriptLoader; readonly transcriptParser?: TranscriptParser }) {
    this.loader = deps.loader;
    this.parser = deps.transcriptParser ?? new TranscriptParser();
  }

  public async parse(input: YouTubeInput, options?: YouTubeTranscriptLoadOptions): Promise<SourceDocument> {
    const transcript = await this.loader.load(input, options);
    return this.parser.parse(transcript);
  }
}

