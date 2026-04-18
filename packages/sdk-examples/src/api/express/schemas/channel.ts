import { z } from "zod";

export const channelIdParam = z.object({
  id: z.string().min(1, "Channel ID, @username, or URL is required"),
});

export const channelVideosQuery = z.object({
  limit: z.coerce.number().int().min(1).max(50).optional(),
});
