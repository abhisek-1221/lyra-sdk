import { KernelError } from "@lyra-sdk/kernel";
import type { Embedding } from "@lyra-sdk/embedding";
import type { ChunkContentResolver, ChunkStrategy, SourceParser } from "@lyra-sdk/ingestion";
import type { BM25Index, IndexedVector, VectorIndex } from "@lyra-sdk/index";
import type { Embedder } from "@lyra-sdk/embedding";
import type { Chunk, ChunkRepository, DocumentRepository } from "@lyra-sdk/storage";
import type { RetrievalPipelineDeps } from "../orchestration/retrieval-pipeline.js";

/**
 * The retrieval runtime. Owns the ingest chain's data flow:
 * parser → chunker → resolver → embedder → index. The runtime
 * itself is stateless across calls; the state lives in the
 * repositories and the index.
 */
export class RetrievalRuntime {
  private readonly sourceParser: SourceParser<unknown>;
  private readonly segmenter: ChunkStrategy;
  private readonly embedder: Embedder;
  private readonly chunks: ChunkRepository;
  private readonly documents: DocumentRepository;
  private readonly index: VectorIndex;
  private readonly contentResolver: ChunkContentResolver;
  private readonly lexicalIndex: BM25Index | undefined;

  constructor(deps: RetrievalPipelineDeps) {
    this.sourceParser = deps.sourceParser;
    this.segmenter = deps.segmenter;
    this.embedder = deps.embedder;
    this.chunks = deps.chunks;
    this.documents = deps.documents;
    this.index = deps.index;
    this.contentResolver = deps.contentResolver;
    this.lexicalIndex = deps.lexicalIndex;
  }

  /**
   * Run the full ingest chain for one source.
   */
  public async ingest(input: unknown): Promise<void> {
    // 1. Parse.
    const document = this.sourceParser.parse(input);

    // 2. Save the document so the resolver can find it later.
    await this.documents.save([document]);

    // 3. Chunk.
    const chunks = await this.segmenter.chunk(document);
    if (chunks.length === 0) return;

    // 4. Save the chunks.
    await this.chunks.save(chunks);

    // 5. Resolve texts on demand. The resolver caches per-document
    //    content internally; one repository read per unique document.
    const texts = await this.contentResolver.resolveMany(chunks);
    if (texts.length !== chunks.length) {
      throw new KernelError(
        "internal",
        `RetrievalRuntime: resolver returned ${texts.length} texts for ${chunks.length} chunks`,
      );
    }

    // 5b. Populate the lexical index (if any) with each chunk's
    //     text. The application owns the index; the pipeline only
    //     feeds it.
    if (this.lexicalIndex !== undefined) {
      for (let i = 0; i < chunks.length; i++) {
        this.lexicalIndex.add(chunks[i]!.id, texts[i]!);
      }
    }

    // 6. Embed in a single batch.
    const embeddings = await this.embedder.embedMany(texts);
    if (embeddings.length !== chunks.length) {
      throw new KernelError(
        "internal",
        `RetrievalRuntime: embedder returned ${embeddings.length} embeddings for ${chunks.length} chunks`,
      );
    }

    // 7. Build IndexedVector[] in chunk order.
    const vectors: IndexedVector[] = [];
    for (let i = 0; i < chunks.length; i++) {
      const chunk = chunks[i]!;
      const emb: Embedding = embeddings[i]!;
      if (emb.vector.length === 0) continue;
      vectors.push({ id: chunk.id, vector: emb.vector });
    }
    if (vectors.length === 0) return;

    // 8. Upsert into the index.
    await this.index.upsert(vectors);
  }

  /**
   * Lifecycle hook. No-op in Phase 1; future phases may add
   * warm-up, prefetch, or metrics emission here.
   */
  public dispose(): void {
    // No resources held by the runtime itself. The repositories and
    // the index are owned by the pipeline, which calls their
    // dispose methods directly.
  }
}

export type { Chunk };
