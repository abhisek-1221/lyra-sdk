import { Router } from "express";
import { channelRoutes } from "./channel.js";
import { playlistRoutes } from "./playlist.js";
import { urlRoutes } from "./url.js";
import { videoRoutes } from "./video.js";

export function routes() {
  const router = Router();

  router.use(videoRoutes);
  router.use(channelRoutes);
  router.use(playlistRoutes);
  router.use(urlRoutes);

  return router;
}
