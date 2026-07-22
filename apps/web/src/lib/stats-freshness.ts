export const STATS_PLAYING_FRESHNESS_MS = 24 * 60 * 60 * 1_000;
export const STATS_PLAYING_INDEX_GRACE_MS = 7 * 24 * 60 * 60 * 1_000;

export function isPlayingTimestampFresh(
  value: string | null | undefined,
  now = Date.now(),
  thresholdMs = STATS_PLAYING_FRESHNESS_MS
): boolean {
  if (!value) return false;
  const timestamp = Date.parse(value);
  return Number.isFinite(timestamp) && timestamp >= now - thresholdMs && timestamp <= now + 5 * 60 * 1_000;
}

export function currentPlayingValue(
  playing: number | null | undefined,
  lastPlayingRefreshedAt: string | null | undefined,
  now = Date.now()
): number | null {
  if (typeof playing !== "number" || !Number.isFinite(playing) || playing < 0) return null;
  return isPlayingTimestampFresh(lastPlayingRefreshedAt, now) ? playing : null;
}
