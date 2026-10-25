import { formatDataApiError, isTransientDataApiFailure } from "../shared/data-api-retry";

const RANGE_DAYS = [1, 7, 14, 30, 90] as const;
const TOP_GAMES = 8;
const TOP_GROUP = 100;
const WIDE_GROUP = 1000;
const DAY_MS = 86_400_000;

export type VisitShareSourceGame = {
  universe_id: string;
  /** Positive, normalized daily deltas only. SQL sends bigints as text. */
  visits: Record<string, string>;
};

export type VisitShareSummaryRow = {
  stat_date: string;
  bucket_key: string;
  bucket_name: string;
  universe_id: string | null;
  bucket_rank_start: number;
  bucket_rank_end: number;
  is_group: boolean;
  visit_delta: string;
  denominator_visit_delta: string;
  denominator_game_count: number;
};

export type VisitShareSummaryWindow = {
  since_date: string;
  until_date: string;
  rows: VisitShareSummaryRow[];
};

type RankedGame = VisitShareSourceGame & { total: bigint };
type WindowCandidates = { since: string; until: string; games: RankedGame[] };
type DailyTotal = { visits: bigint; games: number };

function shiftDate(date: string, days: number) {
  return new Date(new Date(`${date}T00:00:00.000Z`).getTime() + days * DAY_MS).toISOString().slice(0, 10);
}

function compareGames(a: RankedGame, b: RankedGame) {
  if (a.total !== b.total) return a.total > b.total ? -1 : 1;
  const aId = BigInt(a.universe_id);
  const bId = BigInt(b.universe_id);
  return aId < bId ? -1 : aId > bId ? 1 : 0;
}

/**
 * Read ALL games, but retain daily vectors only for the best 1000 per window.
 * A discarded game's total cannot increase: each source batch contains its
 * complete 90-day vector. This is exact window ranking, not daily top-N pruning.
 */
export class VisitShareSummaryBuilder {
  private readonly dailyTotals = new Map<string, DailyTotal>();
  private readonly windows: WindowCandidates[];

  constructor(readonly until: string) {
    this.windows = [until, shiftDate(until, 1)].flatMap((anchor) =>
      RANGE_DAYS.map((days) => ({ since: shiftDate(anchor, -days), until: anchor, games: [] }))
    );
  }

  addBatch(games: VisitShareSourceGame[]) {
    for (const game of games) {
      const days = Object.entries(game.visits).map(([date, value]) => ({ date, visits: BigInt(value) }));
      for (const { date, visits } of days) {
        if (visits <= 0n) throw new Error("Visit-share source must contain positive deltas only");
        const total = this.dailyTotals.get(date) ?? { visits: 0n, games: 0 };
        total.visits += visits;
        total.games += 1;
        this.dailyTotals.set(date, total);
      }
      for (const window of this.windows) {
        let total = 0n;
        for (const day of days) {
          if (day.date >= window.since && day.date <= window.until) total += day.visits;
        }
        if (total > 0n) window.games.push({ ...game, total });
      }
    }
    // Bound retained data after every batch. Vectors are shared across windows.
    for (const window of this.windows) window.games = window.games.sort(compareGames).slice(0, WIDE_GROUP);
  }

  build(): VisitShareSummaryWindow[] {
    return this.windows.map((window) => {
      const buckets = new Map<string, VisitShareSummaryRow>();
      const topByDate = new Map<string, bigint>();
      window.games.forEach((game, index) => {
        const rank = index + 1;
        const individual = rank <= TOP_GAMES;
        const rankStart = individual ? rank : rank <= TOP_GROUP ? TOP_GAMES + 1 : TOP_GROUP + 1;
        const rankEnd = individual ? rank : rank <= TOP_GROUP ? TOP_GROUP : WIDE_GROUP;
        const key = individual ? `g${game.universe_id}` : `rank_${rankStart}_${rankEnd}`;
        for (const [date, value] of Object.entries(game.visits)) {
          if (date < window.since || date > window.until) continue;
          const total = this.dailyTotals.get(date)!;
          const mapKey = `${date}:${key}`;
          const row = buckets.get(mapKey) ?? {
            stat_date: date,
            bucket_key: key,
            // The read RPC resolves current game names, slugs and icons.
            bucket_name: individual ? game.universe_id : `Ranks ${rankStart}-${rankEnd}`,
            universe_id: individual ? game.universe_id : null,
            bucket_rank_start: rankStart,
            bucket_rank_end: rankEnd,
            is_group: !individual,
            visit_delta: "0",
            denominator_visit_delta: total.visits.toString(),
            denominator_game_count: total.games
          };
          const visits = BigInt(value);
          row.visit_delta = (BigInt(row.visit_delta) + visits).toString();
          buckets.set(mapKey, row);
          topByDate.set(date, (topByDate.get(date) ?? 0n) + visits);
        }
      });
      for (const [date, total] of this.dailyTotals) {
        if (date < window.since || date > window.until) continue;
        const other = total.visits - (topByDate.get(date) ?? 0n);
        if (other <= 0n) continue;
        buckets.set(`${date}:other_tracked`, {
          stat_date: date,
          bucket_key: "other_tracked",
          bucket_name: "Other tracked games",
          universe_id: null,
          bucket_rank_start: WIDE_GROUP + 1,
          // The legacy RPC uses the *daily* positive game count here.
          bucket_rank_end: total.games,
          is_group: true,
          visit_delta: other.toString(),
          denominator_visit_delta: total.visits.toString(),
          denominator_game_count: total.games
        });
      }
      const rows = [...buckets.values()].sort((a, b) =>
        a.stat_date.localeCompare(b.stat_date)
        || a.bucket_rank_start - b.bucket_rank_start
        || a.bucket_rank_end - b.bucket_rank_end
        || a.bucket_key.localeCompare(b.bucket_key)
      );
      return { since_date: window.since, until_date: window.until, rows };
    });
  }
}

type RpcResult = { data: unknown; error: { code?: string; message?: string } | null; status?: number };
export type VisitShareRpc = (name: string, args: Record<string, unknown>) => PromiseLike<RpcResult>;
type SourceBatch = { next_after: string | null; games: VisitShareSourceGame[] };

/** One pass, bounded API calls, and one atomic publication after every read succeeds. */
export async function refreshVisitShareSummaries(
  rpc: VisitShareRpc,
  now = new Date(),
  options: { batchSize?: number; sleep?: (ms: number) => Promise<void> } = {}
) {
  const until = now.toISOString().slice(0, 10);
  const builder = new VisitShareSummaryBuilder(until);
  let after = "0";
  let batchSize = Math.min(500, Math.max(1, Math.floor(options.batchSize ?? 250)));
  let sourceGames = 0;
  let retries = 0;
  const sleep = options.sleep ?? ((ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms)));

  while (true) {
    let result: RpcResult;
    try {
      result = await rpc("get_stats_visit_share_source_batch", {
        p_since: shiftDate(until, -90),
        p_until: shiftDate(until, 1),
        p_after_universe_id: after,
        p_limit: batchSize
      });
    } catch (error) {
      if (!isTransientDataApiFailure({ error }) || retries >= 3) throw error;
      retries += 1;
      await sleep(250 * retries);
      continue;
    }
    if (result.error) {
      if (retries < 3 && (result.error.code === "57014" || isTransientDataApiFailure(result))) {
        retries += 1;
        batchSize = Math.max(1, Math.floor(batchSize / 2));
        await sleep(250 * retries);
        continue;
      }
      throw new Error(`Visit-share source failed: ${formatDataApiError(result.error)}`);
    }
    const batch = result.data as SourceBatch | null;
    if (!batch || !Array.isArray(batch.games)) throw new Error("Invalid visit-share source batch");
    if (!batch.games.length) {
      if (batch.next_after !== null) throw new Error("Invalid empty visit-share source cursor");
      break;
    }
    // Fail closed on truncated/duplicated pages rather than publish wrong shares.
    let previous = BigInt(after);
    for (const game of batch.games) {
      const id = BigInt(game.universe_id);
      if (id <= previous) throw new Error("Visit-share source cursor did not advance");
      previous = id;
    }
    if (batch.next_after !== previous.toString()) throw new Error("Incomplete visit-share source batch");
    builder.addBatch(batch.games);
    sourceGames += batch.games.length;
    after = previous.toString();
    retries = 0;
  }

  const windows = builder.build();
  const result = await rpc("replace_stats_visit_share_summaries", {
    p_until: until,
    p_windows: windows,
    p_source_started_at: now.toISOString()
  });
  if (result.error) throw new Error(`Visit-share publication failed: ${formatDataApiError(result.error)}`);
  if (result.data !== 0 && result.data !== 10) throw new Error("Invalid visit-share publication result");
  return {
    windows: result.data,
    sourceGames,
    rows: result.data === 0 ? 0 : windows.reduce((sum, window) => sum + window.rows.length, 0)
  };
}
