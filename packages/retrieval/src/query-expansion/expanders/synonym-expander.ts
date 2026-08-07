import type { QueryExpander } from "../query-expander.js";

/**
 * The synonym expander. Maps each word in the query to a list
 * of known synonyms and emits the original query plus one
 * alternative per word. The original is always the first entry.
 *
 * Phase 2 ships a small, deterministic English synonym table
 * (40 entries). The table is intentionally small — production
 * synonyms should come from a curated domain glossary or an
 * embedding-based expansion, which land in Phase 3+ (LLM-backed
 * `QueryExpander`).
 *
 * The expander is **deterministic** and **offline**: no model
 * calls, no network, no async. The signature is async for
 * contract uniformity.
 */
export class SynonymExpander implements QueryExpander {
  public readonly name = "synonym";
  private readonly synonyms: ReadonlyMap<string, readonly string[]>;

  constructor(options: { synonyms?: ReadonlyMap<string, readonly string[]> } = {}) {
    this.synonyms = options.synonyms ?? new Map(ENGLISH_SYNONYMS);
  }

  public async expand(query: string): Promise<readonly string[]> {
    const tokens = query.toLowerCase().split(/\s+/);
    const out: string[] = [query];
    for (const t of tokens) {
      const alts = this.synonyms.get(t);
      if (alts === undefined || alts.length === 0) continue;
      // Pick the first synonym. Production implementations may
      // enumerate all combinations, but for Phase 2 a single
      // alternative per word is sufficient.
      const alt = alts[0]!;
      const candidate = tokens.map((tok) => (tok === t ? alt : tok)).join(" ");
      if (candidate !== query) out.push(candidate);
    }
    return out;
  }
}

const ENGLISH_SYNONYMS: ReadonlyArray<[string, readonly string[]]> = [
  ["fast", ["quick", "rapid", "swift"]],
  ["quick", ["fast", "rapid", "speedy"]],
  ["big", ["large", "huge", "great"]],
  ["large", ["big", "huge", "great"]],
  ["small", ["tiny", "little", "compact"]],
  ["tiny", ["small", "little", "minute"]],
  ["happy", ["glad", "pleased", "joyful"]],
  ["sad", ["unhappy", "sorrowful", "downcast"]],
  ["good", ["great", "fine", "excellent"]],
  ["bad", ["poor", "awful", "terrible"]],
  ["start", ["begin", "commence", "initiate"]],
  ["begin", ["start", "commence", "kick off"]],
  ["end", ["finish", "conclude", "terminate"]],
  ["finish", ["end", "complete", "conclude"]],
  ["make", ["create", "build", "produce"]],
  ["create", ["make", "build", "produce"]],
  ["use", ["utilize", "employ", "apply"]],
  ["get", ["obtain", "acquire", "fetch"]],
  ["find", ["discover", "locate", "uncover"]],
  ["show", ["display", "exhibit", "reveal"]],
  ["help", ["assist", "aid", "support"]],
  ["learn", ["study", "acquire", "master"]],
  ["know", ["understand", "comprehend", "recognize"]],
  ["think", ["believe", "consider", "reason"]],
  ["say", ["tell", "state", "declare"]],
  ["tell", ["inform", "notify", "relay"]],
  ["give", ["provide", "offer", "supply"]],
  ["take", ["grab", "seize", "capture"]],
  ["put", ["place", "position", "set"]],
  ["go", ["travel", "proceed", "move"]],
  ["come", ["arrive", "approach", "reach"]],
  ["see", ["view", "observe", "watch"]],
  ["hear", ["listen", "perceive", "overhear"]],
  ["feel", ["sense", "experience", "perceive"]],
  ["want", ["desire", "wish", "crave"]],
  ["need", ["require", "demand", "necessitate"]],
  ["try", ["attempt", "endeavor", "seek"]],
  ["ask", ["inquire", "question", "query"]],
  ["answer", ["reply", "respond", "rejoin"]],
];
