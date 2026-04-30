import { z } from "zod";
import { fetchTranscript } from "../../transcript/fetch.js";
import type { TranscriptLine, TranscriptOptions } from "../../transcript/types.js";
import type { ToolDefinition } from "../types.js";
import type { AIToolsConfig } from "../types.js";
import { videoIdParam, videoIdsParam, langParam } from "../schemas.js";

function createOk<T>(data: T) {
  return { success: true as const, data };
}

async function pool<T, R>(
  items: T[],
  limit: number,
  fn: (item: T, index: number) => Promise<R>
): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let next = 0;

  async function worker() {
    while (next < items.length) {
      const idx = next++;
      const item = items[idx];
      if (item !== undefined) {
        results[idx] = await fn(item, idx);
      }
    }
  }

  const workers = Array.from({ length: Math.min(limit, items.length) }, () => worker());
  await Promise.all(workers);
  return results;
}

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
      try {
        const options: TranscriptOptions = { lang };
        if (config.cache) options.cache = config.cache;
        const lines = (await fetchTranscript(videoId, options)) as TranscriptLine[];
        return createOk(lines);
      } catch (err) {
        return { success: false, error: String(err) };
      }
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
      try {
        const results = await pool(
          videoIds,
          5,
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
        );
        return createOk(results);
      } catch (err) {
        return { success: false, error: String(err) };
      }
    },
  };
}
