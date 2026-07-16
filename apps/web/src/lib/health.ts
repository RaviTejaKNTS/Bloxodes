export const STATS_FRESHNESS_WARNING_MS = 6 * 60 * 60 * 1_000;

export function isStaleTimestamp(
  value: string | null | undefined,
  now = Date.now(),
  thresholdMs = STATS_FRESHNESS_WARNING_MS
): boolean {
  if (!value) return true;
  const timestamp = Date.parse(value);
  return !Number.isFinite(timestamp) || timestamp < now - thresholdMs || timestamp > now + 5 * 60 * 1_000;
}
