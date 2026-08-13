export type StatsGrowthTier = "NEW" | "HOT" | "WARM" | "COLD" | null;

export type StatsGrowthRow = {
  hour_start: string;
  playing: number | null;
  peak_playing?: number | null;
};

const HOUR_MS = 60 * 60 * 1000;

export function statsGrowthBaselineToleranceMs(tier: StatsGrowthTier) {
  if (tier === "HOT") return 90 * 60 * 1000;
  if (tier === "WARM") return 7 * HOUR_MS;
  return 12 * HOUR_MS;
}

export function statsGrowthReferenceMs(lastPlayingRefreshedAt: string | null | undefined, fallbackMs = Date.now()) {
  const parsed = lastPlayingRefreshedAt ? Date.parse(lastPlayingRefreshedAt) : Number.NaN;
  return Number.isFinite(parsed) ? parsed : fallbackMs;
}

export function closestStatsGrowthRow(
  rows: StatsGrowthRow[],
  targetMs: number,
  toleranceMs: number
): StatsGrowthRow | null {
  return rows.reduce<StatsGrowthRow | null>((best, row) => {
    if (row.playing == null) return best;
    const time = Date.parse(row.hour_start);
    if (!Number.isFinite(time) || Math.abs(time - targetMs) > toleranceMs) return best;
    if (!best) return row;
    const bestTime = Date.parse(best.hour_start);
    const distance = Math.abs(time - targetMs);
    const bestDistance = Math.abs(bestTime - targetMs);
    return distance < bestDistance || (distance === bestDistance && time > bestTime) ? row : best;
  }, null);
}
