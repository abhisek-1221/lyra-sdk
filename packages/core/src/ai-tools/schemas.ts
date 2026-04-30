import { z } from "zod";

export const videoIdParam = z.string().describe("YouTube video ID or URL");

export const videoIdsParam = z
  .array(z.string())
  .min(1)
  .max(50)
  .describe("Array of YouTube video IDs or URLs (1-50)");

export const channelIdParam = z
  .string()
  .describe("YouTube channel ID, @handle, or URL");

export const playlistIdParam = z.string().describe("YouTube playlist ID or URL");

export const maxResultsParam = z
  .number()
  .int()
  .min(1)
  .max(100)
  .optional()
  .default(20)
  .describe("Maximum number of results to return (1-100)");

export const limitParam = z
  .number()
  .int()
  .min(1)
  .max(50)
  .optional()
  .default(10)
  .describe("Maximum number of results (1-50)");

export const queryParam = z.string().describe("Search query or keyword");

export const langParam = z
  .string()
  .optional()
  .describe("Language code (e.g. en, es, fr, de, ja)");
