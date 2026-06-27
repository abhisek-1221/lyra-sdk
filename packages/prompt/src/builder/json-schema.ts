/**
 * A minimal JSON-schema type. We intentionally do not pull in
 * `ajv` or any schema library; structured outputs only pass the
 * schema through to the provider. Validation of the response is
 * a separate concern (see `@lyra-sdk/generation`'s
 * `parseJsonResponse`).
 *
 * This type is structurally identical to the one in
 * `@lyra-sdk/generation/src/contracts/prompt.ts`. The two
 * declarations are kept in sync by the structural-equality
 * test in `@lyra-sdk/generation/tests/contracts/`.
 */
export type JSONSchema = Readonly<Record<string, unknown>>;
