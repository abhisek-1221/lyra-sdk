import { z } from "zod";
import { yt } from "../index.js";
import type { ToolDefinition } from "../types.js";
import type { AIToolsConfig } from "../types.js";
import { playlistIdParam } from "../schemas.js";

function createOk<T>(data: T) {
  return { success: true as const, data };
}

export function getPlaylistTool(
  config: AIToolsConfig
): ToolDefinition<{ playlistId: string }> {
  const client = yt(config.apiKey);

  return {
    description:
      "Fetch a complete YouTube playlist with all videos, metadata, and total duration. May use multiple quota units for large playlists.",
    parameters: z.object({ playlistId: playlistIdParam }),
    async execute({ playlistId }) {
      try {
        const playlist = await client.playlist(playlistId);
        return createOk(playlist);
      } catch (err) {
        return { success: false, error: String(err) };
      }
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
      try {
        const info = await client.playlistInfo(playlistId);
        return createOk(info);
      } catch (err) {
        return { success: false, error: String(err) };
      }
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
      try {
        const videoIds = await client.playlistVideoIds(playlistId);
        return createOk(videoIds);
      } catch (err) {
        return { success: false, error: String(err) };
      }
    },
  };
}
