import { afterEach, describe, expect, it, vi } from "vitest";
import { AuthError, NotFoundError, QuotaError, YTError } from "../src/errors.js";
import { HttpClient } from "../src/http.js";

function jsonResponse(body: unknown, init?: ResponseInit): Response {
  return new Response(JSON.stringify(body), {
    headers: { "content-type": "application/json" },
    ...init,
  });
}

describe("HttpClient", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("retries transient HTTP failures before returning JSON", async () => {
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(new Response("temporary", { status: 500 }))
      .mockResolvedValueOnce(jsonResponse({ items: [{ id: "abc" }] }));

    const http = new HttpClient({
      apiKey: "test-key",
      baseUrl: "https://example.test",
      maxRetries: 1,
    });

    await expect(
      http.get<{ items: Array<{ id: string }> }>("videos", { id: "abc" })
    ).resolves.toEqual({
      items: [{ id: "abc" }],
    });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("does not retry non-retryable not-found responses", async () => {
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(new Response("missing", { status: 404 }));
    const http = new HttpClient({
      apiKey: "test-key",
      baseUrl: "https://example.test",
      maxRetries: 2,
    });

    await expect(http.get("videos", { id: "abc" })).rejects.toThrow(NotFoundError);
    await expect(http.get("videos", { id: "abc" })).rejects.toThrow("Video not found: abc");
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("maps auth and quota errors without retrying", async () => {
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(new Response("bad API key", { status: 403 }))
      .mockResolvedValueOnce(new Response("quotaExceeded", { status: 403 }));
    const http = new HttpClient({
      apiKey: "test-key",
      baseUrl: "https://example.test",
      maxRetries: 2,
    });

    await expect(http.get("videos", { id: "abc" })).rejects.toThrow(AuthError);
    await expect(http.get("videos", { id: "abc" })).rejects.toThrow(QuotaError);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("surfaces retryable status after retries are exhausted", async () => {
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(new Response("slow down", { status: 429 }));
    const http = new HttpClient({
      apiKey: "test-key",
      baseUrl: "https://example.test",
      maxRetries: 1,
    });

    await expect(http.get("videos", { id: "abc" })).rejects.toMatchObject<Partial<YTError>>({
      statusCode: 429,
    });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});
