import { fetchCaptionList, fetchTranscript } from "../transcript/fetch.js";
import type {
  CaptionTrack,
  TranscriptLine,
  TranscriptOptions,
  TranscriptWithMeta,
} from "../transcript/types.js";

export class TranscriptClient {
  constructor(private readonly defaults?: TranscriptOptions) {}

  async transcribe(
    videoId: string,
    overrides?: TranscriptOptions
  ): Promise<TranscriptLine[] | TranscriptWithMeta> {
    const merged = { ...this.defaults, ...overrides };
    return fetchTranscript(videoId, merged);
  }

  async availableTracks(videoId: string, overrides?: TranscriptOptions): Promise<CaptionTrack[]> {
    const merged = { ...this.defaults, ...overrides };
    return fetchCaptionList(videoId, merged);
  }
}

export function transcribeVideo(
  videoId: string,
  options?: TranscriptOptions
): Promise<TranscriptLine[]>;
export function transcribeVideo(
  videoId: string,
  options: TranscriptOptions & { includeMeta: true }
): Promise<TranscriptWithMeta>;
export function transcribeVideo(
  videoId: string,
  options?: TranscriptOptions
): Promise<TranscriptLine[] | TranscriptWithMeta> {
  return fetchTranscript(videoId, options);
}

export { FsCache, InMemoryCache } from "../transcript/cache/index.js";
export {
  TranscriptDisabledError,
  TranscriptError,
  TranscriptInvalidLangError,
  TranscriptInvalidVideoIdError,
  TranscriptLanguageError,
  TranscriptNotFoundError,
  TranscriptRateLimitError,
  TranscriptVideoUnavailableError,
} from "../transcript/errors.js";
export { toPlainText, toSRT, toVTT } from "../transcript/format.js";
export type {
  CacheStore,
  CaptionTrack,
  TranscriptLine,
  TranscriptOptions,
  TranscriptWithMeta,
  VideoMeta,
} from "../transcript/types.js";
export { fetchCaptionList as listCaptionTracks };
