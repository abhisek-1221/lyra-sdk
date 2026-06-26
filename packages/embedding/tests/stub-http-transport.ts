import { describe, expect, it } from "vitest";
import type { HttpRequest, HttpResponse, HttpTransport } from "../src/transport/http-transport.js";

/**
 * Test helper: a stub `HttpTransport` that returns a pre-canned
 * response and records the requests it received.
 */
export class StubHttpTransport implements HttpTransport {
  public readonly requests: HttpRequest[] = [];
  private readonly response: HttpResponse | ((req: HttpRequest) => HttpResponse);

  constructor(responseOrFactory: HttpResponse | ((req: HttpRequest) => HttpResponse)) {
    this.response = responseOrFactory;
  }

  public async send(request: HttpRequest): Promise<HttpResponse> {
    this.requests.push(request);
    if (typeof this.response === "function") {
      return (this.response as (req: HttpRequest) => HttpResponse)(request);
    }
    return this.response;
  }
}

export function ok(body: unknown): HttpResponse {
  return { status: 200, bodyText: JSON.stringify(body) };
}

export function fail(status: number, body: unknown): HttpResponse {
  return { status, bodyText: typeof body === "string" ? body : JSON.stringify(body) };
}
