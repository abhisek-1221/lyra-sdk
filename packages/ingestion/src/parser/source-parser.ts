import type { SourceDocument } from "@lyra-sdk/storage";

/**
 * A `SourceParser<TInput>` converts an external source representation
 * (transcript, markdown, PDF, Notion page, …) into the canonical
 * `SourceDocument` shape.
 *
 * The parser is the **only** layer that knows about a source format.
 * Everything downstream — chunk strategies, content resolvers, the
 * retriever — operates purely on `SourceDocument`. Adding a new
 * source format means writing a new parser; nothing else changes.
 */
export interface SourceParser<TInput> {
  parse(input: TInput): SourceDocument;
}
