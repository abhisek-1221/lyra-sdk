function sleep(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise<void>((resolve, reject) => {
    signal?.throwIfAborted();
    const timer = setTimeout(resolve, ms);
    if (signal) {
      const onAbort = () => {
        clearTimeout(timer);
        reject(signal.reason);
      };
      signal.addEventListener("abort", onAbort, { once: true });
    }
  });
}

export function isRetryable(status: number): boolean {
  return status === 429 || (status >= 500 && status <= 599);
}

export async function fetchWithRetry(
  fn: () => Promise<Response>,
  retries: number,
  retryDelay: number,
  signal?: AbortSignal
): Promise<Response> {
  for (let attempt = 0; attempt <= retries; attempt++) {
    signal?.throwIfAborted();

    const response = await fn();

    if (!isRetryable(response.status) || attempt === retries) {
      return response;
    }

    await sleep(retryDelay * Math.pow(2, attempt), signal);
  }

  throw new Error("Unexpected: retry loop exited without returning");
}
