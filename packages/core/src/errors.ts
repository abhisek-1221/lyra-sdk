// ---------------------------------------------------------------------------
// lyra-sdk — Custom error hierarchy
// ---------------------------------------------------------------------------

/**
 * Base error for every lyra-sdk failure.
 * All specific errors extend this so consumers can catch broadly or narrowly.
 */
export class YTError extends Error {
  constructor(
    message: string,
    public readonly statusCode?: number,
  ) {
    super(message);
    this.name = "YTError";
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

/** The requested resource (video / channel / playlist) does not exist. */
export class NotFoundError extends YTError {
  constructor(resource: string, id: string) {
    super(`${resource} not found: ${id}`, 404);
    this.name = "NotFoundError";
  }
}

/** YouTube API daily quota has been exhausted. */
export class QuotaError extends YTError {
  constructor(public readonly retryAfter?: string) {
    super("YouTube API quota exceeded. Try again later.", 403);
    this.name = "QuotaError";
  }
}

/** The provided URL could not be parsed as a valid YouTube URL. */
export class InvalidURLError extends YTError {
  constructor(url: string, reason?: string) {
    super(reason ?? `Invalid YouTube URL: ${url}`);
    this.name = "InvalidURLError";
  }
}

/** The API key is missing or was rejected by YouTube. */
export class AuthError extends YTError {
  constructor() {
    super("Invalid or missing YouTube API key.", 401);
    this.name = "AuthError";
  }
}
