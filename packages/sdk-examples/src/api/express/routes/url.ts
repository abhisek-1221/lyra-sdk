import type { Request, Response } from "express";
import { Router } from "express";
import { client } from "../lib.js";
import { urlExtractSchema, urlParseSchema } from "../schemas/url.js";

const router = Router();

router.post("/url/parse", (req: Request, res: Response) => {
  const { url } = urlParseSchema.parse(req.body);
  const result = client.url.parse(url);
  res.json(result);
});

router.post("/url/extract", (req: Request, res: Response) => {
  const { url, type } = urlExtractSchema.parse(req.body);

  if (type === "video" || (!type && client.url.isVideo(url))) {
    const videoId = client.url.extractVideoId(url);
    return res.json({ type: "video", videoId });
  }

  if (type === "playlist" || (!type && client.url.isPlaylist(url))) {
    const playlistId = client.url.extractPlaylistId(url);
    return res.json({ type: "playlist", playlistId });
  }

  const channelId = client.url.extractChannelId(url);
  if (channelId) {
    return res.json({ type: "channel", channelId });
  }

  res.json({ type: "unknown", id: null });
});

export const urlRoutes = router;
