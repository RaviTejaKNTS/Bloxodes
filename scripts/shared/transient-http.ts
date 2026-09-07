export class TransientHttpError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "TransientHttpError";
  }
}

export function isTransientHttpStatus(status: number): boolean {
  return status === 408 || status === 425 || status === 429 || status >= 500;
}

type RetryOptions = {
  attempts?: number;
  delayMs?: number;
  timeoutMs?: number;
  fetchImpl?: typeof fetch;
  sleep?: (delayMs: number) => Promise<void>;
};

export async function fetchWithTransientRetries(
  url: string,
  init: RequestInit = {},
  options: RetryOptions = {},
): Promise<Response> {
  const attempts = options.attempts ?? 4;
  const delayMs = options.delayMs ?? 1_500;
  const timeoutMs = options.timeoutMs ?? 15_000;
  const fetchImpl = options.fetchImpl ?? fetch;
  const sleep = options.sleep ?? ((milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds)));
  let lastDetail = "unknown network error";

  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    let response: Response | null = null;
    try {
      response = await fetchImpl(url, {
        ...init,
        signal: init.signal ?? AbortSignal.timeout(timeoutMs),
      });
    } catch (error) {
      lastDetail = error instanceof Error ? error.message : String(error);
    }

    if (response) {
      if (response.ok) return response;
      lastDetail = `HTTP ${response.status}`;
      await response.body?.cancel();
      if (!isTransientHttpStatus(response.status)) {
        throw new Error(`${url} returned ${lastDetail}.`);
      }
    }

    if (attempt < attempts) await sleep(delayMs * attempt);
  }

  throw new TransientHttpError(`${url} remained unavailable after ${attempts} attempts: ${lastDetail}`);
}
