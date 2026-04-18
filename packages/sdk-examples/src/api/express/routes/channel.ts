import type { Request, Response } from "express";
import { Router } from "express";
import { client } from "../lib.js";
import { channelIdParam, channelVideosQuery } from "../schemas/channel.js";

const router = Router();

router.get("/channel/:id", async (req: Request, res: Response) => {
  const { id } = channelIdParam.parse(req.params);
  const channel = await client.channel(id);
  res.json(channel);
});

router.get("/channel/:id/videos", async (req: Request, res: Response) => {
  const { id } = channelIdParam.parse(req.params);
  const { limit } = channelVideosQuery.parse(req.query);
  const videos = await client.channelVideos(id, { limit });
  res.json(videos);
});

export const channelRoutes = router;
