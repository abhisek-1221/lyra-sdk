import type { DocumentId } from "@lyra-sdk/kernel";
import type { SourceDocument } from "../documents.js";
import type { DocumentRepository } from "../contracts/document-repository.js";

/**
 * In-memory `DocumentRepository`. Phase 1 only.
 *
 * Backed by a `Map<DocumentId, SourceDocument>`. The
 * `SpanChunkContentResolver` reads from this store at retrieval time
 * to materialize a chunk's text on demand.
 */
export class InMemoryDocumentRepository implements DocumentRepository {
  private readonly store = new Map<DocumentId, SourceDocument>();

  public async save(documents: readonly SourceDocument[]): Promise<void> {
    for (const d of documents) {
      this.store.set(d.id, d);
    }
  }

  public async get(id: DocumentId): Promise<SourceDocument | null> {
    return this.store.get(id) ?? null;
  }

  public async delete(id: DocumentId): Promise<void> {
    this.store.delete(id);
  }

  public size(): number {
    return this.store.size;
  }

  public dispose(): void {
    this.store.clear();
  }
}
