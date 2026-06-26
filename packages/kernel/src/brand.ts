/**
 * The `Brand<T, B>` utility attaches a phantom tag to a structural type so
 * two `string`-backed ids cannot be accidentally swapped at compile time.
 *
 * The tag exists only in the type system. There is no runtime cost.
 *
 * ```ts
 * type DocumentId = Brand<string, "DocumentId">;
 * type ChunkId    = Brand<string, "ChunkId">;
 *
 * // @ts-expect-error — cannot pass a DocumentId where a ChunkId is expected
 * declare const d: DocumentId;
 * declare function need(c: ChunkId): void;
 * need(d);
 * ```
 */
export type Brand<T, B extends string> = T & { readonly __brand: B };
