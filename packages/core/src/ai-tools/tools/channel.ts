import { z } from "zod";
import { yt } from "../../index.js";
import { channelIdParam, maxResultsParam } from "../schemas.js";
import type { AIToolsConfig, ToolDefinition } from "../types.js";

export function getChannelTool(
  config: AIToolsConfig
): ToolDefinition<{ channelId: string }> {
  const client = yt(config.apiKey);

  return {
    description:
      "Fetch YouTube channel metadata by ID, @handle, or URL. Returns name, subscribers, description, and thumbnail.",
    parameters: z.object({ channelId: channelIdParam }),
    async execute({ channelId }) {
      return await client.channel(channelId);
    },
  };
}

export function getChannelVideosTool(
  config: AIToolsConfig
): ToolDefinition<{ channelId: string; limit?: number }> {
  const client = yt(config.apiKey);

  return {
    description:
      "Fetch recent uploads from a YouTube channel. Returns a list of videos with titles, thumbnails, and publish dates.",
    parameters: z.object({
      channelId: channelIdParam,
      limit: maxResultsParam,
    }),
    async execute({ channelId, limit }) {
      return await client.channelVideos(channelId, { limit });
    },
  };
}
