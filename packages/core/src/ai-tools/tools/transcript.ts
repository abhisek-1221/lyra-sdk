import { z } from "zod";
import { fetchTranscript } from "../../transcript/fetch.js";
import type { TranscriptLine, TranscriptOptions } from "../../transcript/types.js";
import type { AIToolsConfig, ToolDefinition } from "../types.js";
import { videoIdParam, videoIdsParam, langParam } from "../schemas.js";

export function transcribeVideoTool(
  config: AIToolsConfig
): ToolDefinition<{ videoId: string; lang?: string }> {
  return {
    description:
      "Fetch transcript/captions for a single YouTube video. No API key required. Optionally specify a language code (e.g. en, es, fr).",
    parameters: z.object({
      videoId: videoIdParam,
      lang: langParam,
    }),
    async execute({ videoId, lang }) {
      const options: TranscriptOptions = { lang };
      if (config.cache) options.cache = config.cache;
      return (await fetchTranscript(videoId, options)) as TranscriptLine[];
    },
  };
}

export function batchTranscribeTool(
  config: AIToolsConfig
): ToolDefinition<{ videoIds: string[]; lang?: string }> {
  return {
    description:
      "Batch fetch transcripts for multiple video IDs. Pass an array of YouTube video IDs or URLs. No API key required. Returns per-video results with success/failure status.",
    parameters: z.object({
      videoIds: videoIdsParam.describe(
        "Array of YouTube video IDs to transcribe"
      ),
      lang: langParam,
    }),
    async execute({ videoIds, lang }) {
      const results = await Promise.all(
        videoIds.map(
          async (videoId): Promise<{ videoId: string; status: string; lines?: TranscriptLine[]; error?: string }> => {
            try {
              const options: TranscriptOptions = { lang };
              if (config.cache) options.cache = config.cache;
              const lines = (await fetchTranscript(videoId, options)) as TranscriptLine[];
              return { videoId, status: "success", lines };
            } catch (err) {
              return { videoId, status: "failed", error: String(err) };
            }
          }
        )
      );
      return results;
    },
  };
}
