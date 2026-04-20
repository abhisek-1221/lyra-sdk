export class TranscriptError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "TranscriptError";
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

export class TranscriptRateLimitError extends TranscriptError {
  constructor() {
    super("YouTube is rate-limiting requests from this IP. Try again later or use a proxy.");
    this.name = "TranscriptRateLimitError";
  }
}

export class TranscriptVideoUnavailableError extends TranscriptError {
  constructor(public readonly videoId: string) {
    super(`Video "${videoId}" is unavailable or has been removed.`);
    this.name = "TranscriptVideoUnavailableError";
  }
}

export class TranscriptDisabledError extends TranscriptError {
  constructor(public readonly videoId: string) {
    super(`Transcripts are disabled for video "${videoId}".`);
    this.name = "TranscriptDisabledError";
  }
}

export class TranscriptNotFoundError extends TranscriptError {
  constructor(public readonly videoId: string) {
    super(`No transcript available for video "${videoId}".`);
    this.name = "TranscriptNotFoundError";
  }
}

export class TranscriptLanguageError extends TranscriptError {
  constructor(
    public readonly lang: string,
    public readonly availableLangs: string[],
    public readonly videoId: string
  ) {
    super(
      `No transcript in "${lang}" for video "${videoId}". Available: ${availableLangs.join(", ")}.`
    );
    this.name = "TranscriptLanguageError";
  }
}

export class TranscriptInvalidVideoIdError extends TranscriptError {
  constructor() {
    super("Invalid YouTube video ID or URL. Expected 11-char ID or a valid YouTube URL.");
    this.name = "TranscriptInvalidVideoIdError";
  }
}

export class TranscriptInvalidLangError extends TranscriptError {
  constructor(public readonly lang: string) {
    super(`Invalid BCP 47 language code "${lang}". Examples: "en", "fr", "pt-BR".`);
    this.name = "TranscriptInvalidLangError";
  }
}

export class TranscriptPlaylistError extends TranscriptError {
  constructor(message: string) {
    super(message);
    this.name = "TranscriptPlaylistError";
  }
}
