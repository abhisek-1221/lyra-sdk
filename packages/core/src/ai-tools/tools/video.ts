import { z } from "zod";
import { yt } from "../../index.js";
import { videoIdParam, videoIdsParam } from "../schemas.js";
import type { AIToolsConfig, ToolDefinition } from "../types.js";

export function getVideoTool(config: AIToolsConfig): ToolDefinition<{ videoId: string }> {
  const client = yt(config.apiKey);

  return {
    description:
      "Fetch YouTube video details by ID or URL. Returns title, views, channel, duration, and more.",
    parameters: z.object({ videoId: videoIdParam }),
    async execute({ videoId }) {
      return await client.video(videoId);
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
      return await client.videos(videoIds);
    },
  };
}
