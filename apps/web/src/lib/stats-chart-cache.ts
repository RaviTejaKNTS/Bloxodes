import "server-only";

// Shared chart and optional insight answers are the same for every visitor and may be a few
// minutes old. Keep one copy per key in this web process so a traffic burst
// (or a slow database) costs one query instead of one query per request.
export const STATS_CHART_CACHE_MS = 5 * 60 * 1000;

type CacheEntry = { value: unknown; storedAt: number };

const values = new Map<string, CacheEntry>();
const pending = new Map<string, Promise<unknown>>();

/**
 * Returns the cached chart for `key`, loading it at most once per `ttlMs`.
 * Concurrent misses share one load. After expiry the last good value is served
 * while one background load refreshes it. A load that throws or returns null
 * never replaces a good value; `null` means no good value exists yet.
 */
export async function cachedStatsChart<T>(
  key: string,
  load: () => Promise<T | null>,
  ttlMs = STATS_CHART_CACHE_MS,
  now: () => number = Date.now
): Promise<T | null> {
  const entry = values.get(key);
  if (entry && now() - entry.storedAt < ttlMs) return entry.value as T;

  let request = pending.get(key) as Promise<T | null> | undefined;
  if (!request) {
    request = load()
      .then((value) => {
        if (value != null) {
          // Per-game insights add variable keys; bound process memory while
          // keeping the same last-good/stale-while-revalidate contract.
          if (!values.has(key) && values.size >= 2048) values.delete(values.keys().next().value!);
          values.set(key, { value, storedAt: now() });
        }
        return value;
      })
      .catch((error: unknown) => {
        console.warn(`Failed to refresh stats chart ${key}`, error instanceof Error ? error.message : error);
        return null;
      })
      .finally(() => {
        pending.delete(key);
      });
    pending.set(key, request);
  }

  if (entry) return entry.value as T;
  const value = await request;
  return value ?? ((values.get(key)?.value as T | undefined) ?? null);
}
