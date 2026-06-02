import "../shared/load-env";

import { supabaseAdmin } from "@/lib/supabase-admin";
import { isStatsTier, type StatsTier } from "./stats-tier";

const DEFAULT_LIMIT = Number(process.env.UNIVERSE_RANK_LIMIT ?? "250");
const RANK_TYPES = ["global_playing", "global_visits", "global_favorites", "global_rating"] as const;

type RankType = (typeof RANK_TYPES)[number];

type UniverseRankRow = {
  universe_id: number;
  playing: number | null;
  visits: number | null;
  favorites: number | null;
  likes: number | null;
  dislikes: number | null;
};

type Options = {
  limit: number;
  tier: StatsTier | "ALL";
};

function metricFor(row: UniverseRankRow, rankType: RankType): number | null {
  if (rankType === "global_playing") return row.playing ?? null;
  if (rankType === "global_visits") return row.visits ?? null;
  if (rankType === "global_favorites") return row.favorites ?? null;
  const likes = row.likes ?? 0;
  const dislikes = row.dislikes ?? 0;
  const total = likes + dislikes;
  if (total < 20) return null;
  return Math.round((likes / total) * 1000) / 10;
}

async function fetchRankRows(rankType: RankType, options: Options): Promise<UniverseRankRow[]> {
  const sb = supabaseAdmin();
  const orderColumn =
    rankType === "global_playing"
      ? "playing"
      : rankType === "global_visits"
      ? "visits"
      : rankType === "global_favorites"
      ? "favorites"
      : "likes";
  let query = sb
    .from("roblox_universes")
    .select("universe_id, playing, visits, favorites, likes, dislikes")
    .not(orderColumn, "is", null)
    .order(orderColumn, { ascending: false })
    .limit(options.limit);

  if (options.tier !== "ALL") {
    query = query.eq("stats_tier", options.tier);
  } else {
    query = query.neq("stats_tier", "NEW");
  }

  const { data, error } = await query;
  if (error) throw error;
  const rows = (data ?? []) as UniverseRankRow[];
  if (rankType !== "global_rating") return rows;
  return rows
    .map((row) => ({ row, metric: metricFor(row, rankType) }))
    .filter((entry): entry is { row: UniverseRankRow; metric: number } => entry.metric != null)
    .sort((a, b) => b.metric - a.metric)
    .slice(0, options.limit)
    .map((entry) => entry.row);
}

async function writeRankType(rankType: RankType, options: Options, sampledAt: string) {
  const rows = await fetchRankRows(rankType, options);
  const payload = rows
    .map((row, index) => ({
      universe_id: row.universe_id,
      rank_type: rankType,
      rank_value: index + 1,
      metric_value: metricFor(row, rankType),
      sampled_at: sampledAt
    }))
    .filter((row) => row.metric_value != null);
  if (!payload.length) return 0;
  const { error } = await supabaseAdmin()
    .from("roblox_universe_rank_snapshots")
    .upsert(payload, { onConflict: "universe_id,rank_type,sampled_at" });
  if (error) throw error;
  return payload.length;
}

function parseArgs(): Options {
  const args = process.argv.slice(2);
  const options: Options = {
    limit: Number.isFinite(DEFAULT_LIMIT) && DEFAULT_LIMIT > 0 ? DEFAULT_LIMIT : 250,
    tier: "ALL"
  };
  for (let i = 0; i < args.length; i += 1) {
    const arg = args[i];
    if (arg === "--limit" || arg === "-l") {
      const parsed = Number(args[i + 1]);
      options.limit = Number.isFinite(parsed) && parsed > 0 ? parsed : options.limit;
      i += 1;
    } else if (arg === "--tier") {
      const tier = String(args[i + 1] ?? "").toUpperCase();
      if (tier === "ALL" || isStatsTier(tier)) {
        options.tier = tier;
      } else {
        throw new Error(`Invalid --tier value: ${tier}. Use HOT, WARM, COLD, NEW, or ALL.`);
      }
      i += 1;
    } else if (arg === "--all") {
      options.tier = "ALL";
    } else if (arg === "--quality-only") {
      options.tier = "HOT";
    } else if (arg === "--help" || arg === "-h") {
      console.log(`
Usage: npm run stats:rank -- [options]

Options:
  -l, --limit <number>   Number of rows to rank per metric (default: ${DEFAULT_LIMIT})
  --tier <tier>          Rank one stats tier: HOT, WARM, COLD, NEW, or ALL (default: ALL except NEW)
  --all                  Rank all non-NEW universes
  -h, --help             Show this help text
`);
      process.exit(0);
    }
  }
  return options;
}

async function main() {
  const options = parseArgs();
  const sampledAt = new Date();
  sampledAt.setUTCMinutes(0, 0, 0);
  const sampledAtIso = sampledAt.toISOString();
  for (const rankType of RANK_TYPES) {
    const count = await writeRankType(rankType, options, sampledAtIso);
    console.log(`Ranked ${count} rows for ${rankType}.`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
