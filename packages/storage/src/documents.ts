import type { DocumentId } from "@lyra-sdk/kernel";

/**
 * A `DocumentBlock` is a single structured unit within a `SourceDocument`.
 * Parsers (e.g. `TranscriptParser`, future `MarkdownParser`, `PdfParser`)
 * populate `blocks` to project the source's natural structure — chapters,
 * sections, captions, code blocks, table rows.
 *
 * The chunk strategy MAY choose to respect block boundaries (one chunk
 * per block) or to cross them (merging across blocks until a token
 * budget is hit). Both are valid; this layer does not impose either.
 */
export interface DocumentBlock {
  readonly text: string;
  readonly metadata: Readonly<Record<string, string | number | boolean>>;
}

/**
 * A `SourceDocument` is the canonical, post-parse representation of an
 * ingested source. It carries two parallel views of the same content:
 *
 *  - `content`: the materialized string buffer used for slicing via
 *    `TextSpan` offsets. The chunker and content resolver slice this
 *    on demand; it is allocated exactly once, inside the parser.
 *
 *  - `blocks`: a structured, parser-projected view. The chunker can
 *    reason about block boundaries without re-parsing. Future formats
 *    (PDF, Markdown, Notion) get natural structure for free.
 *
 * `metadata` carries the source's own metadata (video id, language,
 * author, etc.) for use by retrieval-time filters and citations.
 */
export interface SourceDocument {
  readonly id: DocumentId;
  readonly sourceUri: string;
  readonly content: string;
  readonly blocks: readonly DocumentBlock[];
  readonly metadata: Readonly<Record<string, string | number | boolean>>;
}
