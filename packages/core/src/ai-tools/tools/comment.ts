import { z } from "zod";
import { yt } from "../../index.js";
import { maxResultsParam, queryParam, videoIdParam } from "../schemas.js";
import type { AIToolsConfig, ToolDefinition } from "../types.js";

function createOk<T>(data: T) {
  return { success: true as const, data };
}

export function getCommentsTool(
  config: AIToolsConfig
): ToolDefinition<{ videoId: string; maxResults?: number }> {
  const client = yt(config.apiKey);

  return {
    description:
      "Fetch comment threads for a YouTube video with auto-pagination. Returns top-level comments with reply counts.",
    parameters: z.object({
      videoId: videoIdParam,
      maxResults: maxResultsParam,
    }),
    async execute({ videoId, maxResults }) {
      try {
        const threads = await client.comments(videoId, {
          maxResults,
          textFormat: "plainText",
        });
        return createOk(threads);
      } catch (err) {
        return { success: false, error: String(err) };
      }
    },
  };
}

export function getTopCommentsTool(
  config: AIToolsConfig
): ToolDefinition<{ videoId: string; limit?: number }> {
  const client = yt(config.apiKey);

  return {
    description:
      "Fetch top comments for a YouTube video sorted by relevance. Good for quick sentiment checks.",
    parameters: z.object({
      videoId: videoIdParam,
      limit: maxResultsParam.describe("Number of top comments to return"),
    }),
    async execute({ videoId, limit }) {
      try {
        const threads = await client.topComments(videoId, limit);
        return createOk(threads);
      } catch (err) {
        return { success: false, error: String(err) };
      }
    },
  };
}

export function searchCommentsTool(
  config: AIToolsConfig
): ToolDefinition<{ videoId: string; query: string }> {
  const client = yt(config.apiKey);

  return {
    description: "Search comments on a YouTube video by keyword. Returns matching comment threads.",
    parameters: z.object({
      videoId: videoIdParam,
      query: queryParam,
    }),
    async execute({ videoId, query }) {
      try {
        const threads = await client.searchComments(videoId, query);
        return createOk(threads);
      } catch (err) {
        return { success: false, error: String(err) };
      }
    },
  };
}
