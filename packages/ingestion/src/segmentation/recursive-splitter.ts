import type { DocumentId, TextSpan } from "@lyra-sdk/kernel";

/**
 * The default hierarchical delimiter set used by `RecursiveSplitter`.
 *
 * The splitter tries each level in order. For each level, it splits the
 * input at the delimiter. If the resulting pieces are all smaller than
 * the chunk size, it stops. Otherwise, it descends one level on any
 * over-sized piece.
 *
 * Order matters: paragraph → line → sentence → word → character. The
 * splitter never cuts inside a token at the deepest level — when it
 * reaches characters, it is because the input has no structural
 * separators, and the caller is expected to size chunks accordingly.
 */
export const DEFAULT_SEPARATORS: readonly string[] = ["\n\n", "\n", ". ", " ", ""];

/**
 * Options for {@link RecursiveSplitter}.
 */
export interface RecursiveSplitterOptions {
  /**
   * Soft target size in characters. The splitter does not enforce a
   * hard cap; it uses the size only to decide when to stop descending
   * delimiter levels. The merger is responsible for honoring a real
   * token budget.
   *
   * Default: 2000.
   */
  readonly chunkSize?: number;
  /**
   * Ordered list of delimiters. Each delimiter is tried in order; the
   * splitter stops descending once all resulting pieces fit.
   *
   * Default: {@link DEFAULT_SEPARATORS}.
   */
  readonly separators?: readonly string[];
}

/**
 * The recursive, delimiter-preserving splitter. Phase 1's only splitter.
 *
 * Given a `SourceDocument.content` string and a `DocumentId`, returns
 * a list of `TextSpan`s. The algorithm:
 *
 *   1. Try the current level of separators.
 *   2. Split the input at every occurrence of any separator in the level.
 *   3. For each resulting piece: if smaller than `chunkSize`, keep it as
 *      a final span; otherwise, descend one level.
 *   4. If the level is the empty separator (i.e. the deepest), fall
 *      back to fixed-window slicing so the algorithm always terminates.
 *
 * Zero-width splits are never produced: when the splitter finds a
 * separator, it records the offset of the position **after** the
 * separator as the next span's `start`. Adjacent spans share a single
 * boundary offset; no span has `start === end`.
 */
export class RecursiveSplitter {
  private readonly chunkSize: number;
  private readonly separators: readonly string[];

  constructor(options: RecursiveSplitterOptions = {}) {
    this.chunkSize = options.chunkSize ?? 2000;
    this.separators = options.separators ?? DEFAULT_SEPARATORS;
  }

  /**
   * Split a document's content into `TextSpan`s.
   *
   * @param sourceId  the owning document's id
   * @param content   the document's content string
   */
  public split(sourceId: DocumentId, content: string): readonly TextSpan[] {
    if (content.length === 0) return [];
    return this.splitLevel(sourceId, content, 0, 0);
  }

  private splitLevel(
    sourceId: DocumentId,
    text: string,
    level: number,
    baseOffset: number,
  ): readonly TextSpan[] {
    if (text.length <= this.chunkSize) {
      return [this.span(sourceId, baseOffset, baseOffset + text.length)];
    }
    const sep = this.separators[level];
    if (sep === undefined) {
      // Deepest level reached; fall back to fixed-window slicing so we
      // always terminate. This branch only fires when `separators` ends
      // with `""` and we somehow still exceed chunkSize (essentially
      // unreachable with a sane chunk size, but the guard is correct).
      return this.fixedWindow(sourceId, text, baseOffset);
    }
    const pieces = sep === "" ? this.characterPieces(text) : this.splitOn(text, sep);
    const spans: TextSpan[] = [];
    for (const piece of pieces) {
      if (piece.text.length === 0) continue;
      if (piece.text.length <= this.chunkSize) {
        spans.push(this.span(sourceId, baseOffset + piece.start, baseOffset + piece.end));
      } else {
        spans.push(...this.splitLevel(sourceId, piece.text, level + 1, baseOffset + piece.start));
      }
    }
    return spans;
  }

  private fixedWindow(sourceId: DocumentId, text: string, baseOffset: number): readonly TextSpan[] {
    const out: TextSpan[] = [];
    const stride = this.chunkSize;
    for (let i = 0; i < text.length; i += stride) {
      out.push(this.span(sourceId, baseOffset + i, baseOffset + Math.min(i + stride, text.length)));
    }
    return out;
  }

  private splitOn(text: string, sep: string): readonly { start: number; end: number; text: string }[] {
    if (sep.length === 0) return [{ start: 0, end: text.length, text }];
    const out: { start: number; end: number; text: string }[] = [];
    let cursor = 0;
    while (cursor < text.length) {
      const idx = text.indexOf(sep, cursor);
      if (idx === -1) {
        out.push({ start: cursor, end: text.length, text: text.slice(cursor) });
        break;
      }
      const end = idx + sep.length;
      out.push({ start: cursor, end, text: text.slice(cursor, end) });
      cursor = end;
    }
    return out;
  }

  private characterPieces(text: string): readonly { start: number; end: number; text: string }[] {
    const out: { start: number; end: number; text: string }[] = [];
    for (let i = 0; i < text.length; i++) {
      out.push({ start: i, end: i + 1, text: text[i]! });
    }
    return out;
  }

  private span(sourceId: DocumentId, start: number, end: number): TextSpan {
    return { sourceId, start, end };
  }
}
