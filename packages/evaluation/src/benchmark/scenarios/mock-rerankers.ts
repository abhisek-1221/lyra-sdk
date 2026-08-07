import type { ScoredChunk } from "@lyra-sdk/retrieval";
import type { RerankResult, Reranker } from "@lyra-sdk/reranking";

/**
 * A mock reranker that reverses the candidate list. Useful as
 * a "no rerank" baseline in benchmarks.
 */
export class MockReverserReranker implements Reranker {
  public readonly name = "mock-reverser";
  async rerank(_query: string, candidates: readonly ScoredChunk[]): Promise<RerankResult> {
    return { results: [...candidates].reverse(), durationMs: 0 };
  }
}

/**
 * A mock reranker that pretends to be a cross-encoder
 * provider (Jina / Voyage / Cohere / BGE). It scores the
 * candidates using a deterministic function of the chunk id
 * (so the same chunk always gets the same score, and
 * benchmarks are reproducible). The benchmark is the only
 * intended consumer.
 */
export class MockJinaReranker implements Reranker {
  public readonly name = "mock-jina";
  async rerank(query: string, candidates: readonly ScoredChunk[]): Promise<RerankResult> {
    const ranked = [...candidates].sort((a, b) => {
      const sa = mockScore(query, a.chunk.id);
      const sb = mockScore(query, b.chunk.id);
      return sb - sa;
    });
    return { results: ranked, durationMs: 0 };
  }
}

export class MockVoyageReranker implements Reranker {
  public readonly name = "mock-voyage";
  async rerank(query: string, candidates: readonly ScoredChunk[]): Promise<RerankResult> {
    const ranked = [...candidates].sort((a, b) => {
      const sa = mockScore(query, a.chunk.id);
      const sb = mockScore(query, b.chunk.id);
      return sb - sa;
    });
    return { results: ranked, durationMs: 0 };
  }
}

export class MockCohereReranker implements Reranker {
  public readonly name = "mock-cohere";
  async rerank(query: string, candidates: readonly ScoredChunk[]): Promise<RerankResult> {
    const ranked = [...candidates].sort((a, b) => {
      const sa = mockScore(query, a.chunk.id);
      const sb = mockScore(query, b.chunk.id);
      return sb - sa;
    });
    return { results: ranked, durationMs: 0 };
  }
}

export class MockBGEReranker implements Reranker {
  public readonly name = "mock-bge";
  async rerank(query: string, candidates: readonly ScoredChunk[]): Promise<RerankResult> {
    const ranked = [...candidates].sort((a, b) => {
      const sa = mockScore(query, a.chunk.id);
      const sb = mockScore(query, b.chunk.id);
      return sb - sa;
    });
    return { results: ranked, durationMs: 0 };
  }
}

/**
 * Deterministic score: a hash of the query and chunk id, scaled
 * to [0, 1). The hash is `String` xor-folded; the same input
 * always produces the same output.
 */
function mockScore(query: string, chunkId: unknown): number {
  const s = `${query}|${String(chunkId)}`;
  let h = 0;
  for (let i = 0; i < s.length; i++) {
    h = (h * 31 + s.charCodeAt(i)) >>> 0;
  }
  return (h % 10000) / 10000;
}
