import type { Request, Response } from "express";
import { Router } from "express";
import { client } from "../lib.js";
import { playlistIdParam, playlistQuerySchema } from "../schemas/playlist.js";

const router = Router();

router.get("/playlist/:id", async (req: Request, res: Response) => {
  const { id } = playlistIdParam.parse(req.params);
  const playlist = await client.playlist(id);
  res.json(playlist);
});

router.get("/playlist/:id/info", async (req: Request, res: Response) => {
  const { id } = playlistIdParam.parse(req.params);
  const info = await client.playlistInfo(id);
  res.json(info);
});

router.get("/playlist/:id/ids", async (req: Request, res: Response) => {
  const { id } = playlistIdParam.parse(req.params);
  const ids = await client.playlistVideoIds(id);
  res.json({ id, videoIds: ids, count: ids.length });
});

router.post("/playlist/:id/query", async (req: Request, res: Response) => {
  const { id } = playlistIdParam.parse(req.params);
  const body = playlistQuerySchema.parse(req.body);

  let query = client.playlistQuery(id);

  if (body.filter?.duration) {
    query = query.filterByDuration(body.filter.duration);
  }
  if (body.filter?.views) {
    query = query.filterByViews(body.filter.views);
  }
  if (body.filter?.likes) {
    query = query.filterByLikes(body.filter.likes);
  }
  if (body.sort) {
    query = query.sortBy(body.sort.field, body.sort.order);
  }
  if (body.range) {
    query = query.between(body.range.start, body.range.end);
  }

  const result = await query.execute();
  res.json(result);
});

export const playlistRoutes = router;
