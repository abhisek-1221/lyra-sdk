import type { Request, Response } from "express";
import { Router } from "express";
import { transcribePlaylist, InMemoryCache } from "lyra-sdk/transcript";
import { batchTranscriptSchema } from "../schemas/transcript.js";

const cache = new InMemoryCache();
const router = Router();

router.post("/playlist/:id/transcript", async (req: Request, res: Response) => {
  const { id } = req.params;
  const body = batchTranscriptSchema.parse(req.body);

  const result = await transcribePlaylist(id, {
    apiKey: process.env.YOUTUBE_API_KEY!,
    ...body,
    cache,
    onProgress(done, total, videoId, status) {
      console.log(`  [${status}] ${done}/${total} — ${videoId}`);
    },
  });

  res.json(result);
});

export const transcriptRoutes = router;
