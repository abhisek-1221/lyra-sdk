import type { TranscriptWithMeta } from "lyra-sdk";
import type { YouTubeInput } from "./youtube-input.js";

export interface YouTubeTranscriptLoadOptions {
  /**
   * Passed through to `lyra-sdk` transcript fetcher. Kept optional so
   * `@lyra-sdk/ingestion` remains usable without consumers needing to
   * understand every core option.
   */
  readonly transcriptOptions?: Readonly<Record<string, unknown>>;
}

/**
 * Async boundary for YouTube transcript acquisition.
 *
 * This is intentionally separated from `TranscriptParser` (sync,
 * pure mapping) so the retrieval pipeline can keep its synchronous
 * `SourceParser<T>` contract.
 */
export interface YouTubeTranscriptLoader {
  load(input: YouTubeInput, options?: YouTubeTranscriptLoadOptions): Promise<TranscriptWithMeta>;
}

