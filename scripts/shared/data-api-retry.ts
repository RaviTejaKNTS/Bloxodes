type DataApiError = {
  code?: string | null;
  message?: string | null;
  details?: string | null;
  hint?: string | null;
};

export type DataApiResult = {
  error: DataApiError | null;
  status?: number;
};

export type DataApiRetryOptions = {
  retryLimit?: number;
  baseDelayMs?: number;
  maxDelayMs?: number;
  sleep?: (ms: number) => Promise<void>;
};

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

function readPositiveNumber(name: string, fallback: number): number {
  const raw = process.env[name];
  if (!raw) return fallback;
  const parsed = Number(raw);
  return Number.isFinite(parsed) && parsed >= 0 ? Math.floor(parsed) : fallback;
}

function jitter(ms: number) {
  return Math.round(ms * (0.75 + Math.random() * 0.5));
}

function errorField(error: unknown, field: keyof DataApiError) {
  if (!error || typeof error !== "object") return null;
  const value = (error as Record<string, unknown>)[field];
  return typeof value === "string" ? value : null;
}

export function formatDataApiError(error: unknown) {
  if (error instanceof Error) return error.message;
  if (typeof error === "string") return error;
  if (!error) return "Unknown Data API failure";

  const parts = [errorField(error, "message"), errorField(error, "details"), errorField(error, "hint")].filter(Boolean);
  if (parts.length) return parts.join("; ");

  try {
    return JSON.stringify(error);
  } catch {
    return String(error);
  }
}

export function isTransientDataApiFailure(input: { error?: unknown; status?: number }) {
  if ([502, 503, 504, 520].includes(input.status ?? 0)) return true;

  const code = errorField(input.error, "code")?.toUpperCase() ?? "";
  if (["PGRST000", "PGRST001", "PGRST002", "PGRST003"].includes(code)) return true;

  const normalized = formatDataApiError(input.error).toLowerCase();
  return (
    normalized.includes("an invalid response was received from the upstream server") ||
    normalized.includes("fetch failed") ||
    normalized.includes("network error") ||
    normalized.includes("connection reset")
  );
}

function dataApiFailureMessage(label: string, result: DataApiResult) {
  const status = result.status ? ` (${result.status})` : "";
  const code = result.error?.code ? ` ${result.error.code}` : "";
  return `${label} failed${status}${code}: ${formatDataApiError(result.error)}`;
}

export async function runDataApiOperation<T extends DataApiResult>(
  label: string,
  operation: () => PromiseLike<T>,
  options: DataApiRetryOptions = {}
): Promise<T> {
  const retryLimit = Math.max(
    0,
    Math.floor(options.retryLimit ?? readPositiveNumber("UNIVERSE_STATS_DATA_API_RETRY_LIMIT", 3))
  );
  const baseDelayMs = Math.max(
    0,
    Math.floor(options.baseDelayMs ?? readPositiveNumber("UNIVERSE_STATS_DATA_API_RETRY_BASE_DELAY_MS", 500))
  );
  const maxDelayMs = Math.max(
    baseDelayMs,
    Math.floor(options.maxDelayMs ?? readPositiveNumber("UNIVERSE_STATS_DATA_API_RETRY_MAX_DELAY_MS", 5000))
  );
  const wait = options.sleep ?? sleep;

  for (let attempt = 0; attempt <= retryLimit; attempt += 1) {
    let result: T;
    try {
      result = await operation();
    } catch (error) {
      if (!isTransientDataApiFailure({ error }) || attempt >= retryLimit) throw error;
      const delayMs = jitter(Math.min(baseDelayMs * 2 ** attempt, maxDelayMs));
      console.warn(`${label} request failed; retrying in ${delayMs}ms`);
      await wait(delayMs);
      continue;
    }

    if (!result.error) return result;
    if (!isTransientDataApiFailure(result) || attempt >= retryLimit) {
      throw new Error(dataApiFailureMessage(label, result));
    }

    const delayMs = jitter(Math.min(baseDelayMs * 2 ** attempt, maxDelayMs));
    console.warn(`${label} returned a transient Data API failure; retrying in ${delayMs}ms`);
    await wait(delayMs);
  }

  throw new Error(`${label} failed after retries`);
}
