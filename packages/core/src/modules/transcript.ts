import { fetchTranscript, fetchCaptionList } from "../transcript/fetch.js";
import type {
  TranscriptOptions,
  TranscriptLine,
  TranscriptWithMeta,
  CaptionTrack,
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

  async availableTracks(
    videoId: string,
    overrides?: TranscriptOptions
  ): Promise<CaptionTrack[]> {
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

export { fetchCaptionList as listCaptionTracks };

export {
  TranscriptError,
  TranscriptRateLimitError,
  TranscriptVideoUnavailableError,
  TranscriptDisabledError,
  TranscriptNotFoundError,
  TranscriptLanguageError,
  TranscriptInvalidVideoIdError,
  TranscriptInvalidLangError,
} from "../transcript/errors.js";

export { toSRT, toVTT, toPlainText } from "../transcript/format.js";

export type {
  TranscriptLine,
  TranscriptWithMeta,
  VideoMeta,
  CaptionTrack,
  TranscriptOptions,
} from "../transcript/types.js";
