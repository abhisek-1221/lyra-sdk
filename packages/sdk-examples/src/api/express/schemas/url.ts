import { z } from "zod";

export const urlParseSchema = z.object({
  url: z.string().min(1, "URL is required"),
});

export const urlExtractSchema = z.object({
  url: z.string().min(1, "URL is required"),
  type: z.enum(["video", "playlist", "channel"]).optional(),
});
