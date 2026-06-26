/**
 * Structural mirror of `lyra-sdk`'s transcript types.
 *
 * `lyra-sdk` is declared as an **optional peer dependency** of this
 * package. To keep `@lyra-sdk/ingestion` buildable in isolation (and
 * testable without forcing consumers to install `lyra-sdk` upfront), we
 * declare a structurally identical subset of the transcript types we
 * need (`TranscriptLine`, `VideoMeta`, `TranscriptWithMeta`).
 *
 * Any value that satisfies `lyra-sdk`'s real types ALSO satisfies these
 * structural mirrors, because both are TypeScript structural types.
 * This is the same pattern used by `zod`, `drizzle-orm`, and other
 * optional-peer-dep packages.
 *
 * If/when we need additional fields (e.g. `isLiveContent` filtering
 * by chapters), they get added here AND to `lyra-sdk`'s type. The
 * structural compatibility gives the compiler a chance to catch drift
 * at the call site.
 */

export interface TranscriptLineMirror {
  readonly text: string;
  readonly duration: number;
  readonly offset: number;
  readonly lang: string;
}

export interface VideoMetaMirror {
  readonly videoId: string;
  readonly title: string;
  readonly author: string;
  readonly channelId: string;
  readonly lengthSeconds: number;
  readonly viewCount: number;
  readonly description: string;
  readonly keywords: readonly string[];
  readonly thumbnails: ReadonlyArray<{
    readonly url: string;
    readonly width: number;
    readonly height: number;
  }>;
  readonly isLiveContent: boolean;
}

export interface TranscriptWithMetaMirror {
  readonly meta: VideoMetaMirror;
  readonly lines: readonly TranscriptLineMirror[];
}
