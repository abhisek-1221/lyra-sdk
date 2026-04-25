import type { NextFunction, Request, Response } from "express";
import { AuthError, InvalidURLError, NotFoundError, QuotaError, YTError } from "lyra-sdk";
import { TranscriptError } from "lyra-sdk/transcript";
import { ZodError } from "zod";

export function apiError(err: Error, _req: Request, res: Response, _next: NextFunction) {
  if (err instanceof ZodError) {
    res.status(400).json({
      error: {
        code: 400,
        message: "Validation error",
        details: err.issues.map((i) => `${i.path.join(".")}: ${i.message}`),
      },
    });
    return;
  }

  if (err instanceof NotFoundError) {
    res.status(404).json({ error: { code: 404, message: err.message } });
    return;
  }

  if (err instanceof AuthError) {
    res.status(401).json({ error: { code: 401, message: err.message } });
    return;
  }

  if (err instanceof QuotaError) {
    res.status(429).json({ error: { code: 429, message: err.message } });
    return;
  }

  if (err instanceof InvalidURLError) {
    res.status(400).json({ error: { code: 400, message: err.message } });
    return;
  }

  if (err instanceof TranscriptError) {
    const status = "status" in err ? (err as any).status ?? 500 : 500;
    res.status(status).json({ error: { code: status, message: err.message } });
    return;
  }

  if (err instanceof YTError) {
    res.status(502).json({ error: { code: 502, message: err.message } });
    return;
  }

  console.error("Unhandled error:", err);
  res.status(500).json({ error: { code: 500, message: "Internal server error" } });
}
