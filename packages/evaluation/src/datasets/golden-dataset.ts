import type { RetrievalDataset, RetrievalExample } from "./retrieval-dataset.js";

/**
 * A hand-curated retrieval dataset. The list of examples is
 * passed in at construction; the dataset is the most
 * authoritative form of ground truth.
 */
export class GoldenDataset implements RetrievalDataset {
  public readonly name: string;
  public readonly examples: readonly RetrievalExample[];

  constructor(options: { name: string; examples: readonly RetrievalExample[] }) {
    this.name = options.name;
    this.examples = options.examples;
  }
}
