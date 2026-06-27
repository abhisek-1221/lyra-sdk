/**
 * Format a citation marker for chunk `i`. The default in
 * `DefaultPromptBuilder` is `(i) => `[${i + 1}]``, which emits
 * `[1]`, `[2]`, etc.
 *
 * Applications that want a different marker — superscripts,
 * letters, `(doc:chunk)` keys — pass a custom function to
 * `PromptBuildArgs.citationFormat`.
 */
export type CitationFormat = (index: number) => string;
