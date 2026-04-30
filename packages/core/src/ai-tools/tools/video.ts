import { z } from "zod";
import { yt } from "../../index.js";
import { videoIdParam, videoIdsParam } from "../schemas.js";
import type { AIToolsConfig, ToolDefinition } from "../types.js";

function createOk<T>(data: T) {
  return { success: true as const, data };
}

export function getVideoTool(config: AIToolsConfig): ToolDefinition<{ videoId: string }> {
  const client = yt(config.apiKey);

  return {
    description:
      "Fetch YouTube video details by ID or URL. Returns title, views, channel, duration, and more.",
    parameters: z.object({ videoId: videoIdParam }),
    async execute({ videoId }) {
      try {
        const video = await client.video(videoId);
        return createOk(video);
      } catch (err) {
        return { success: false, error: String(err) };
      }
    },
  };
}

export function getVideosTool(config: AIToolsConfig): ToolDefinition<{ videoIds: string[] }> {
  const client = yt(config.apiKey);

  return {
    description:
      "Batch fetch multiple YouTube videos by IDs or URLs. Returns details for each video.",
    parameters: z.object({ videoIds: videoIdsParam }),
    async execute({ videoIds }) {
      try {
        const videos = await client.videos(videoIds);
        return createOk(videos);
      } catch (err) {
        return { success: false, error: String(err) };
      }
    },
  };
}
