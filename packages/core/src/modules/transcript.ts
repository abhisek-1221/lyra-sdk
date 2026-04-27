import { transcribePlaylist as batchTranscribePlaylist } from "../transcript/batch.js";
import { fetchCaptionList, fetchTranscript } from "../transcript/fetch.js";
import type {
  CaptionTrack,
  PlaylistTranscriptOptions,
  PlaylistTranscriptResult,
  TranscriptLine,
  TranscriptOptions,
  TranscriptOptionsWithMeta,
  TranscriptOptionsWithoutMeta,
  TranscriptWithMeta,
} from "../transcript/types.js";

export class TranscriptClient {
  constructor(private readonly defaults?: TranscriptOptions) {}

  async transcribe(
    videoId: string,
    overrides: TranscriptOptionsWithMeta
  ): Promise<TranscriptWithMeta>;
  async transcribe(
    videoId: string,
    overrides: TranscriptOptionsWithoutMeta
  ): Promise<TranscriptLine[]>;
  async transcribe(
    videoId: string,
    overrides?: TranscriptOptions
  ): Promise<TranscriptLine[] | TranscriptWithMeta>;
  async transcribe(videoId: string, overrides?: TranscriptOptions) {
    const merged = { ...this.defaults, ...overrides };
    return fetchTranscript(videoId, merged);
  }

  async availableTracks(videoId: string, overrides?: TranscriptOptions): Promise<CaptionTrack[]> {
    const merged = { ...this.defaults, ...overrides };
    return fetchCaptionList(videoId, merged);
  }

  async transcribePlaylist(
    playlistUrlOrId: string,
    overrides?: PlaylistTranscriptOptions
  ): Promise<PlaylistTranscriptResult> {
    const merged = { ...this.defaults, ...overrides } as PlaylistTranscriptOptions;
    return batchTranscribePlaylist(playlistUrlOrId, merged);
  }
}

export function transcribeVideo(
  videoId: string,
  options: TranscriptOptionsWithMeta
): Promise<TranscriptWithMeta>;
export function transcribeVideo(
  videoId: string,
  options?: TranscriptOptionsWithoutMeta
): Promise<TranscriptLine[]>;
export function transcribeVideo(
  videoId: string,
  options?: TranscriptOptions
): Promise<TranscriptLine[] | TranscriptWithMeta> {
  return fetchTranscript(videoId, options);
}

export { transcribePlaylist } from "../transcript/batch.js";
export { FsCache, InMemoryCache } from "../transcript/cache/index.js";
export {
  TranscriptDisabledError,
  TranscriptError,
  TranscriptInvalidLangError,
  TranscriptInvalidVideoIdError,
  TranscriptLanguageError,
  TranscriptNotFoundError,
  TranscriptPlaylistError,
  TranscriptRateLimitError,
  TranscriptVideoUnavailableError,
} from "../transcript/errors.js";
export { toPlainText, toSRT, toVTT } from "../transcript/format.js";
export type {
  CacheStore,
  CaptionTrack,
  PlaylistTranscriptOptions,
  PlaylistTranscriptResult,
  TranscriptLine,
  TranscriptOptions,
  TranscriptOptionsWithMeta,
  TranscriptOptionsWithoutMeta,
  TranscriptWithMeta,
  VideoMeta,
  VideoTranscriptResult,
  VideoTranscriptStatus,
} from "../transcript/types.js";
export { fetchCaptionList as listCaptionTracks };
