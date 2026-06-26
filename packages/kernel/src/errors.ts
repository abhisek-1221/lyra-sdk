/**
 * Stable, machine-readable error codes emitted by every layer of the
 * Lyra retrieval runtime.
 *
 * Layers SHOULD use these constants instead of string literals so consumers
 * can switch on the code without parsing messages.
 */
export type KernelErrorCode =
  | "invalid_id"
  | "invalid_span"
  | "invalid_argument"
  | "not_found"
  | "conflict"
  | "io"
  | "network"
  | "rate_limit"
  | "auth"
  | "upstream"
  | "internal";

/**
 * The base error class for the entire retrieval runtime. Every layer
 * (kernel, ingestion, embedding, storage, index, retrieval, pipeline)
 * throws errors of this shape.
 *
 * The runtime hierarchy is intentionally flat: there is exactly one
 * `KernelError` class with a `code` discriminator. Specialized error
 * shapes are produced by the layer that raises them, but they all
 * ultimately resolve to a `KernelError` at the boundary.
 */
export class KernelError extends Error {
  public readonly code: KernelErrorCode;
  public readonly cause?: unknown;

  constructor(code: KernelErrorCode, message: string, options?: { cause?: unknown }) {
    super(message, options);
    this.name = "KernelError";
    this.code = code;
    if (options?.cause !== undefined) {
      this.cause = options.cause;
    }
    // Preserve a clean stack across older runtimes.
    if (typeof (Error as { captureStackTrace?: unknown }).captureStackTrace === "function") {
      (Error as unknown as { captureStackTrace: (target: object, ctor: Function) => void })
        .captureStackTrace(this, KernelError);
    }
  }

  /**
   * Render a single-line summary suitable for logs.
   *
   * Format: `[KernelError:<code>] <message>`
   */
  public summary(): string {
    return `[KernelError:${this.code}] ${this.message}`;
  }
}

/**
 * Convenience guard: narrow a thrown value to a `KernelError` and recover
 * its code, or `undefined` if the value is not one.
 *
 * ```ts
 * try {
 *   await pipeline.ingest(t);
 * } catch (err) {
 *   const code = kernelErrorCode(err);
 *   if (code === "rate_limit") return retryLater();
 *   throw err;
 * }
 * ```
 */
export function kernelErrorCode(err: unknown): KernelErrorCode | undefined {
  if (err instanceof KernelError) {
    return err.code;
  }
  return undefined;
}
