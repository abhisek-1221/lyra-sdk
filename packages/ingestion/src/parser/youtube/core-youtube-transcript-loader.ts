import { KernelError } from "@lyra-sdk/kernel";
import type { TranscriptOptionsWithMeta, TranscriptWithMeta } from "lyra-sdk";
import type { YouTubeInput } from "./youtube-input.js";
import { normalizeYouTubeInput } from "./youtube-input.js";
import type { YouTubeTranscriptLoader, YouTubeTranscriptLoadOptions } from "./youtube-transcript-loader.js";

async function importLyraSdk(): Promise<typeof import("lyra-sdk")> {
  try {
    return await import("lyra-sdk");
  } catch (err) {
    throw new KernelError(
      "invalid_argument",
      "`@lyra-sdk/ingestion` YouTube transcript loading requires the optional peer dependency `lyra-sdk` to be installed.",
      { cause: err },
    );
  }
}

function asTranscriptOptionsWithMeta(
  raw: YouTubeTranscriptLoadOptions["transcriptOptions"],
): TranscriptOptionsWithMeta {
  const base = (raw ?? {}) as Record<string, unknown>;
  // Force meta because `TranscriptParser` expects it and because the
  // RAG stack benefits from stable video metadata.
  return { ...(base as object), includeMeta: true } as TranscriptOptionsWithMeta;
}

/**
 * Default YouTube transcript loader backed by `lyra-sdk/transcript`.
 */
export class CoreYouTubeTranscriptLoader implements YouTubeTranscriptLoader {
  public async load(
    input: YouTubeInput,
    options?: YouTubeTranscriptLoadOptions,
  ): Promise<TranscriptWithMeta> {
    const lyra = await importLyraSdk();
    const normalized = normalizeYouTubeInput(input);

    const videoId =
      "videoId" in normalized
        ? normalized.videoId
        : (() => {
            const id = lyra.extractVideoId(normalized.url);
            if (!id) {
              throw new KernelError("invalid_argument", `Invalid YouTube URL: ${normalized.url}`);
            }
            return id;
          })();

    return (await lyra.transcribeVideo(videoId, asTranscriptOptionsWithMeta(options?.transcriptOptions))) as TranscriptWithMeta;
  }
}

