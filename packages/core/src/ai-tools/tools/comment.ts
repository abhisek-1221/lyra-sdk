import { z } from "zod";
import { yt } from "../../index.js";
import { videoIdParam, maxResultsParam, queryParam } from "../schemas.js";
import type { AIToolsConfig, ToolDefinition } from "../types.js";

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
      return await client.comments(videoId, {
        maxResults,
        textFormat: "plainText",
      });
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
      return await client.topComments(videoId, limit);
    },
  };
}

export function searchCommentsTool(
  config: AIToolsConfig
): ToolDefinition<{ videoId: string; query: string }> {
  const client = yt(config.apiKey);

  return {
    description:
      "Search comments on a YouTube video by keyword. Returns matching comment threads.",
    parameters: z.object({
      videoId: videoIdParam,
      query: queryParam,
    }),
    async execute({ videoId, query }) {
      return await client.searchComments(videoId, query);
    },
  };
}
