import { describe, expect, it } from "vitest";
import {
  createChunkId,
  createDocumentId,
  createEmbeddingId,
  KernelError,
  newChunkId,
  newEmbeddingId,
} from "../src/index.js";

describe("createDocumentId", () => {
  it("accepts a valid id", () => {
    expect(createDocumentId("dQw4w9WgXcQ")).toBe("dQw4w9WgXcQ");
  });

  it("accepts alphanumerics, underscores, and dashes", () => {
    expect(createDocumentId("a-b_c-1_2")).toBe("a-b_c-1_2");
  });

  it("rejects an empty string", () => {
    expect(() => createDocumentId("")).toThrow(KernelError);
  });

  it("rejects whitespace and punctuation", () => {
    for (const bad of ["has space", "has/slash", "has.dot"]) {
      expect(() => createDocumentId(bad)).toThrow(KernelError);
      try {
        createDocumentId(bad);
      } catch (err) {
        expect(err).toBeInstanceOf(KernelError);
        expect((err as KernelError).code).toBe("invalid_id");
      }
    }
  });
});

describe("createChunkId", () => {
  it("accepts a valid id and rejects invalid", () => {
    expect(createChunkId("chunk-001")).toBe("chunk-001");
    expect(() => createChunkId("")).toThrow(KernelError);
  });
});

describe("createEmbeddingId", () => {
  it("accepts a valid id and rejects invalid", () => {
    expect(createEmbeddingId("emb-001")).toBe("emb-001");
    expect(() => createEmbeddingId("")).toThrow(KernelError);
  });
});

describe("newChunkId / newEmbeddingId", () => {
  it("returns a uuid-shaped string each time", () => {
    const a = newChunkId();
    const b = newChunkId();
    expect(a).not.toBe(b);
    expect(a).toMatch(/^[0-9a-f-]{36}$/i);
  });

  it("returns a uuid-shaped embedding id", () => {
    expect(newEmbeddingId()).toMatch(/^[0-9a-f-]{36}$/i);
  });
});

describe("KernelError", () => {
  it("captures code and message", () => {
    const err = new KernelError("not_found", "chunk not found");
    expect(err.code).toBe("not_found");
    expect(err.message).toBe("chunk not found");
    expect(err.name).toBe("KernelError");
  });

  it("summary is single-line and includes code", () => {
    const err = new KernelError("rate_limit", "too many requests");
    expect(err.summary()).toBe("[KernelError:rate_limit] too many requests");
  });

  it("preserves cause", () => {
    const cause = new Error("socket reset");
    const err = new KernelError("network", "fetch failed", { cause });
    expect(err.cause).toBe(cause);
  });
});
