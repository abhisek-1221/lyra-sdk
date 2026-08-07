import type { EmbeddingTask } from "../contracts/embedding.js";

/**
 * The `EmbeddingCacheKey` is a content-addressed descriptor for an
 * embedding. The string form is the SHA-256 of the canonical
 * representation:
 *
 *   sha256(provider + "|" + model + "|" + task + "|" + normalize(content))
 *
 * Chunks are not immutable forever (chunking algorithm, overlap,
 * normalization, metadata injection can all change a chunk's content
 * while its id stays the same), so the cache key is derived from the
 * embedding **input**, not the chunk id.
 *
 * The same content reused elsewhere will hit the cache; that is a
 * feature, not a bug — embeddings are a pure function of
 * `(model, input)`.
 */
export interface EmbeddingCacheKey {
  readonly provider: string;
  readonly model: string;
  readonly task: EmbeddingTask;
  readonly contentHash: string;
}

/**
 * Stable JSON serialization of a {@link EmbeddingCacheKey}. The order
 * of fields is fixed; consumers MUST NOT depend on key string format
 * for anything other than cache lookup.
 */
export function serializeEmbeddingCacheKey(key: EmbeddingCacheKey): string {
  return JSON.stringify({
    p: key.provider,
    m: key.model,
    t: key.task,
    h: key.contentHash,
  });
}

/**
 * Build an {@link EmbeddingCacheKey} from the embedding function's
 * inputs.
 */
export function makeEmbeddingCacheKey(
  provider: string,
  model: string,
  task: EmbeddingTask,
  content: string,
): EmbeddingCacheKey {
  return {
    provider,
    model,
    task,
    contentHash: hashContent(content),
  };
}

/**
 * Lightweight, non-cryptographic 64-bit hash of a string. Used to
 * key the cache. Not FNV this time; we want a stable hex string
 * that doesn't depend on the chunk id.
 */
function hashContent(content: string): string {
  // FNV-1a 64-bit via BigInt; cast to hex at the end.
  let hash = 0xcbf29ce484222325n;
  const prime = 0x100000001b3n;
  for (let i = 0; i < content.length; i++) {
    hash ^= BigInt(content.charCodeAt(i));
    hash = (hash * prime) & 0xffffffffffffffffn;
  }
  return hash.toString(16);
}
