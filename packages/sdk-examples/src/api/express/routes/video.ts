import type { Request, Response } from "express";
import { Router } from "express";
import { client } from "../lib.js";
import { videoIdParam, videoIdsQuery } from "../schemas/video.js";

const router = Router();

router.get("/video/:id", async (req: Request, res: Response) => {
  const { id } = videoIdParam.parse(req.params);
  const video = await client.video(id);
  res.json(video);
});

router.get("/videos", async (req: Request, res: Response) => {
  const { ids } = videoIdsQuery.parse(req.query);
  const idList = ids.split(",").map((s) => s.trim());
  const videos = await client.videos(idList);
  res.json(videos);
});

router.get("/video/:id/title", async (req: Request, res: Response) => {
  const { id } = videoIdParam.parse(req.params);
  const title = await client.videoTitle(id);
  res.json({ id, title });
});

export const videoRoutes = router;
