/**
 * The `HttpTransport` is the minimal abstraction the embedding layer
 * needs to talk to remote APIs. Providers take an `HttpTransport` via
 * constructor injection and never call `fetch` directly.
 *
 * In production, {@link FetchHttpTransport} wraps the global `fetch`.
 * In tests, a stub `HttpTransport` returns canned responses without
 * any network I/O. This keeps the embedding layer testable in
 * isolation and lets callers supply a custom transport (with
 * retries, auth refresh, observability hooks) without touching the
 * provider code.
 */
export interface HttpRequest {
  readonly url: string;
  readonly method: "GET" | "POST";
  readonly headers: Readonly<Record<string, string>>;
  readonly body: string;
}

export interface HttpResponse {
  readonly status: number;
  readonly bodyText: string;
}

export interface HttpTransport {
  send(request: HttpRequest, signal?: AbortSignal): Promise<HttpResponse>;
}

/**
 * The default transport. Wraps the global `fetch` (Node 22+ / browsers).
 */
export class FetchHttpTransport implements HttpTransport {
  public async send(request: HttpRequest, signal?: AbortSignal): Promise<HttpResponse> {
    const init: RequestInit = {
      method: request.method,
      headers: request.headers,
      body: request.body,
    };
    if (signal) {
      init.signal = signal;
    }
    const res = await fetch(request.url, init);
    return {
      status: res.status,
      bodyText: await res.text(),
    };
  }
}
