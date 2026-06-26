/**
 * A `QueryExpander` generates one or more search queries from a
 * single input query. The expanded queries are run through a
 * downstream `Retriever` (typically inside a
 * `MultiQueryRetriever`); the per-query results are then
 * aggregated.
 *
 * Implementations MUST:
 *   - Always include the original query in the result. The
 *     downstream `MultiQueryRetriever` echoes the input
 *     `RetrievalResult.query` as the original, but each per-query
 *     call uses one of the expanded strings.
 *   - Return at least one query (the original alone is valid).
 *   - Be deterministic for the same input, unless the
 *     implementation is explicitly stochastic.
 *
 * The contract is async because Phase 3+ implementations may
 * call an LLM. Phase 2 ships deterministic expanders only.
 */
export interface QueryExpander {
  readonly name: string;
  expand(query: string): Promise<readonly string[]>;
}
