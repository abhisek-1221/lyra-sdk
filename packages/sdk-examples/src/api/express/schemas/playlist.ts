import { z } from "zod";

export const playlistIdParam = z.object({
  id: z.string().min(1, "Playlist ID or URL is required"),
});

export const playlistQuerySchema = z.object({
  filter: z
    .object({
      duration: z
        .object({
          min: z.number().int().min(0).optional(),
          max: z.number().int().min(0).optional(),
        })
        .optional(),
      views: z
        .object({
          min: z.number().int().min(0).optional(),
          max: z.number().int().min(0).optional(),
        })
        .optional(),
      likes: z
        .object({
          min: z.number().int().min(0).optional(),
          max: z.number().int().min(0).optional(),
        })
        .optional(),
    })
    .optional(),
  sort: z
    .object({
      field: z.enum(["duration", "views", "likes"]),
      order: z.enum(["asc", "desc"]),
    })
    .optional(),
  range: z
    .object({
      start: z.number().int().min(1),
      end: z.number().int().min(1),
    })
    .optional(),
});
