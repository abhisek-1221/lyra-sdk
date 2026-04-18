import { z } from "zod";

export const videoIdParam = z.object({
  id: z.string().min(1, "Video ID or URL is required"),
});

export const videoIdsQuery = z.object({
  ids: z.string().min(1, "Comma-separated video IDs required"),
});
