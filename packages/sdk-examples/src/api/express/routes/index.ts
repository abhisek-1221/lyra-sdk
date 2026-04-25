import { Router } from "express";
import { channelRoutes } from "./channel.js";
import { commentRoutes } from "./comment.js";
import { playlistRoutes } from "./playlist.js";
import { transcriptRoutes } from "./transcript.js";
import { urlRoutes } from "./url.js";
import { videoRoutes } from "./video.js";

export function routes() {
  const router = Router();

  router.use(videoRoutes);
  router.use(channelRoutes);
  router.use(playlistRoutes);
  router.use(urlRoutes);
  router.use(commentRoutes);
  router.use(transcriptRoutes);

  return router;
}
