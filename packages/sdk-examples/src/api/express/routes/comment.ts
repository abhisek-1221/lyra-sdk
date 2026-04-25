import type { Request, Response } from "express";
import { Router } from "express";
import { client } from "../lib.js";
import {
  commentVideoIdParam,
  commentIdParam,
  commentsQuery,
  topCommentsQuery,
} from "../schemas/comment.js";

const router = Router();

router.get("/comments/:videoId", async (req: Request, res: Response) => {
  const { videoId } = commentVideoIdParam.parse(req.params);
  const { order, maxResults, search } = commentsQuery.parse(req.query);

  const threads = await client!.comments(videoId, {
    order,
    maxResults,
    searchTerms: search,
  });

  res.json(threads);
});

router.get("/comments/:videoId/top", async (req: Request, res: Response) => {
  const { videoId } = commentVideoIdParam.parse(req.params);
  const { limit } = topCommentsQuery.parse(req.query);

  const threads = await client!.topComments(videoId, limit);
  res.json(threads);
});

router.get("/comment-replies/:id", async (req: Request, res: Response) => {
  const { id } = commentIdParam.parse(req.params);

  const replies = await client!.commentReplies(id);
  res.json(replies);
});

export const commentRoutes = router;
