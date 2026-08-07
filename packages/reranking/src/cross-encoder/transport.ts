import type { HttpTransport } from "@lyra-sdk/embedding";

/**
 * The cross-encoder transport. The reranking package reuses
 * `@lyra-sdk/embedding`'s `HttpTransport` for the actual HTTP
 * round-trip. This re-export makes the dependency explicit and
 * lets the cross-encoder package take a `CrossEncoderTransport`
 * type as a parameter without re-importing from `@lyra-sdk/embedding`
 * in every call site.
 */
export type CrossEncoderTransport = HttpTransport;
