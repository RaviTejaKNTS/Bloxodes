/** Service-only SQL wire contract. No application or runtime imports. */
export type PreparedRange = '1d' | '7d' | '14d' | '30d' | '90d';
export type PreparedResolution = 'hourly' | 'daily' | 'weekly' | 'monthly';
export type PreparedState = 'ready' | 'partial' | 'last-good' | 'empty' | 'unavailable';
export type PreparedNumeric = number | string;
export type PeriodCoverage = {
  expectedBuckets: number;
  processedBuckets: number;
  observedBuckets: number;
  missingBuckets: string[];
  firstSourceAt: string | null;
  lastSourceAt: string | null;
  finalizedThrough: string | null;
  provisional: boolean;
  reason: 'complete' | 'source-gap' | 'not-built' | 'retention-gap' |
    'producer-behind' | 'membership-change' | 'zero-denominator';
};
export type PreparedMeta = {
  contract: 'stats-prepared@1';
  state: PreparedState;
  generationId: string | null;
  asOf: string | null;
  windowStart: string | null;
  windowEnd: string | null;
  sourceAsOf: string | null;
  sourceUpdatedAt: string | null;
  generatedAt: string | null;
  publishedAt: string | null;
  checkedAt: string | null;
  sourceRevision: string | null;
  current: PeriodCoverage;
  previous?: PeriodCoverage;
};
/** hourly: hour_start only; other resolutions: stat_date only (UTC).
 * Weekly/monthly rows remain DAILY inputs; app performs existing range-relative
 * sample-weighted bucketing against meta.windowStart/windowEnd. No REST row cap.
 * Decimal strings protect bigint precision; reject unsafe integer conversion.
 */
export type PreparedPlatformRow = {
  hour_start?: string;
  stat_date?: string;
  playing: PreparedNumeric;
  peak_players: PreparedNumeric;
  avg_players: PreparedNumeric | null;
  visits: PreparedNumeric | null;
  favorites: PreparedNumeric | null;
  rating_percent: PreparedNumeric | null;
  tracked_games: PreparedNumeric;
  samples: PreparedNumeric;
  recorded_at: string | null;
};
export type PreparedPlatformResponse = {
  contract: 'stats-prepared@1';
  meta: PreparedMeta;
  currentRows: PreparedPlatformRow[];
  previousRows?: PreparedPlatformRow[];
};
export type PreparedVisitSeries = {
  key: string; universeId: PreparedNumeric | null; name: string;
  slug: string | null; iconUrl: string | null; color: string;
  totalVisits: PreparedNumeric; sharePercent: number; isOther: boolean;
  isGroup: boolean; rankStart: number | null; rankEnd: number | null;
};
export type PreparedVisitPoint = {
  label: string; tooltipLabel: string; sampledAt: string;
  totalVisits: PreparedNumeric; shares: Record<string, number>;
  visits: Record<string, PreparedNumeric>;
};
export type PreparedVisitChart = {
  range: PreparedRange; points: PreparedVisitPoint[]; series: PreparedVisitSeries[];
  denominatorGameCount: number; visibleGameCount: number;
  totalVisits: PreparedNumeric; generatedAt: string | null;
};
export type PreparedVisitResponse = {
  contract: 'stats-prepared@1'; meta: PreparedMeta; chart: PreparedVisitChart;
};
/** Server-selected step, opaque cursor stored in SQL. Caller cannot select SQL,
 * dates, tables, limits, generation IDs or membership. One step per transaction. */
export type PreparedWork = { kind: 'advance' };
export type PreparedClaim = {
  claimed: boolean; leaseToken?: string; epoch?: PreparedNumeric;
  expiresAt?: string; work?: PreparedWork[];
};
export type PreparedHealth = {
  schemaVersion: 'stats-prepared@1'; rpcAllowlist: string[];
  ok: true;
  operational: Record<string, unknown>;
};
