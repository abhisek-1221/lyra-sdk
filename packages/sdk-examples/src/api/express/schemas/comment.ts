import { z } from "zod";

export const commentVideoIdParam = z.object({
  videoId: z.string().min(1, "Video ID or URL is required"),
});

export const commentIdParam = z.object({
  id: z.string().min(1, "Comment ID is required"),
});

export const commentsQuery = z.object({
  order: z.enum(["time", "relevance"]).optional().default("time"),
  maxResults: z.coerce.number().int().min(1).optional().default(100),
  search: z.string().optional(),
});

export const topCommentsQuery = z.object({
  limit: z.coerce.number().int().min(1).optional().default(10),
});
