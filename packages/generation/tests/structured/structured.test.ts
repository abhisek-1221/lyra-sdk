import { describe, expect, it } from "vitest";
import { parseJsonResponse } from "../../src/structured/index.js";

describe("parseJsonResponse", () => {
  it("returns undefined when no schema is supplied", () => {
    expect(parseJsonResponse("not json", undefined)).toBeUndefined();
  });

  it("parses valid JSON when a schema is supplied", () => {
    const result = parseJsonResponse<{ a: number }>('{"a":1}', { type: "object" });
    expect(result).toEqual({ a: 1 });
  });

  it("throws on invalid JSON when a schema is supplied", () => {
    expect(() => parseJsonResponse("not json", { type: "object" })).toThrow();
  });

  it("preserves the type parameter at the call site", () => {
    interface UserProfile {
      readonly name: string;
      readonly age: number;
    }
    const result = parseJsonResponse<UserProfile>('{"name":"x","age":1}', { type: "object" });
    // Type-level: result is UserProfile. The runtime check is
    // just that the value parses.
    expect(result?.name).toBe("x");
  });
});
