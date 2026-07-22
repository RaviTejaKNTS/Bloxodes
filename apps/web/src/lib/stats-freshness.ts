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

export function currentPlayingRankValue(
  rank: number | null | undefined,
  lastPlayingRefreshedAt: string | null | undefined,
  now = Date.now()
): number | null {
  if (typeof rank !== "number" || !Number.isFinite(rank) || rank < 1) return null;
  return isPlayingTimestampFresh(lastPlayingRefreshedAt, now) ? Math.floor(rank) : null;
}

export function isPlayingRankSnapshotWithinFreshnessWindow(
  sampledAt: string | null | undefined,
  lastPlayingRefreshedAt: string | null | undefined,
  now = Date.now()
): boolean {
  if (!sampledAt || !lastPlayingRefreshedAt) return false;
  const sampledTimestamp = Date.parse(sampledAt);
  const refreshedTimestamp = Date.parse(lastPlayingRefreshedAt);
  return (
    Number.isFinite(sampledTimestamp) &&
    Number.isFinite(refreshedTimestamp) &&
    sampledTimestamp <= refreshedTimestamp + STATS_PLAYING_FRESHNESS_MS &&
    sampledTimestamp <= now + 5 * 60 * 1_000
  );
}
