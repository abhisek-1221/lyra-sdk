import { z } from "zod";
import { yt } from "../../index.js";
import { playlistIdParam } from "../schemas.js";
import type { AIToolsConfig, ToolDefinition } from "../types.js";

export function getPlaylistTool(
  config: AIToolsConfig
): ToolDefinition<{ playlistId: string }> {
  const client = yt(config.apiKey);

  return {
    description:
      "Fetch a complete YouTube playlist with all videos, metadata, and total duration. May use multiple quota units for large playlists.",
    parameters: z.object({ playlistId: playlistIdParam }),
    async execute({ playlistId }) {
      return await client.playlist(playlistId);
    },
  };
}

export function getPlaylistInfoTool(
  config: AIToolsConfig
): ToolDefinition<{ playlistId: string }> {
  const client = yt(config.apiKey);

  return {
    description:
      "Fetch YouTube playlist metadata only (title, description, video count). Uses 1 quota unit. Does not return individual videos.",
    parameters: z.object({ playlistId: playlistIdParam }),
    async execute({ playlistId }) {
      return await client.playlistInfo(playlistId);
    },
  };
}

export function getPlaylistVideosTool(
  config: AIToolsConfig
): ToolDefinition<{ playlistId: string }> {
  const client = yt(config.apiKey);

  return {
    description:
      "List all video IDs in a YouTube playlist. Fast, uses 1 quota unit. Use this before batchTranscribe to get the video IDs you want to transcribe.",
    parameters: z.object({ playlistId: playlistIdParam }),
    async execute({ playlistId }) {
      return await client.playlistVideoIds(playlistId);
    },
  };
}
