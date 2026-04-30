import { z } from "zod";
import { yt } from "../index.js";
import type { ToolDefinition } from "../types.js";
import type { AIToolsConfig } from "../types.js";
import { channelIdParam, maxResultsParam } from "../schemas.js";

function createOk<T>(data: T) {
  return { success: true as const, data };
}

export function getChannelTool(
  config: AIToolsConfig
): ToolDefinition<{ channelId: string }> {
  const client = yt(config.apiKey);

  return {
    description:
      "Fetch YouTube channel metadata by ID, @handle, or URL. Returns name, subscribers, description, and thumbnail.",
    parameters: z.object({ channelId: channelIdParam }),
    async execute({ channelId }) {
      try {
        const channel = await client.channel(channelId);
        return createOk(channel);
      } catch (err) {
        return { success: false, error: String(err) };
      }
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
      try {
        const videos = await client.channelVideos(channelId, { limit });
        return createOk(videos);
      } catch (err) {
        return { success: false, error: String(err) };
      }
    },
  };
}
