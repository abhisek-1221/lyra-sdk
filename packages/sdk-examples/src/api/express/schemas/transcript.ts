import { z } from "zod";

export const transcriptSchema = z.object({
  lang: z.string().optional(),
});

export const batchTranscriptSchema = z.object({
  concurrency: z.coerce.number().int().min(1).max(20).optional().default(3),
  from: z.coerce.number().int().min(1).optional(),
  to: z.coerce.number().int().min(1).optional(),
  lang: z.string().optional(),
});
