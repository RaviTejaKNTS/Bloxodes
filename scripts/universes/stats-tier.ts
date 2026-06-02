export const STATS_TIERS = ["NEW", "HOT", "WARM", "COLD"] as const;

export type StatsTier = (typeof STATS_TIERS)[number];

type TierInput = {
  playing?: number | null;
  visits?: number | null;
  lastStatsRefreshedAt?: string | null;
};

export function isStatsTier(value: string | undefined): value is StatsTier {
  return STATS_TIERS.includes(value as StatsTier);
}

export function assignStatsTier(input: TierInput): { tier: StatsTier; reason: string } {
  const playing = typeof input.playing === "number" && Number.isFinite(input.playing) ? Math.max(input.playing, 0) : null;
  const visits = typeof input.visits === "number" && Number.isFinite(input.visits) ? Math.max(input.visits, 0) : null;

  if (!input.lastStatsRefreshedAt || (playing == null && visits == null)) {
    return { tier: "NEW", reason: "new_or_missing_stats" };
  }
  if ((playing ?? 0) >= 100) {
    return { tier: "HOT", reason: "playing_gte_100" };
  }
  if ((visits ?? 0) >= 250_000_000) {
    return { tier: "HOT", reason: "visits_gte_250m" };
  }
  if ((playing ?? 0) >= 30) {
    return { tier: "WARM", reason: "playing_gte_30" };
  }
  if ((visits ?? 0) >= 10_000_000) {
    return { tier: "WARM", reason: "visits_gte_10m" };
  }
  return { tier: "COLD", reason: "remaining_valid_game" };
}
