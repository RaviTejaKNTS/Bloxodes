import "../shared/load-env";

import { supabaseAdmin } from "@/lib/supabase-admin";

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
  qualityOnly: boolean;
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

  if (options.qualityOnly) {
    query = query.eq("is_quality_candidate", true);
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
    qualityOnly: true
  };
  for (let i = 0; i < args.length; i += 1) {
    const arg = args[i];
    if (arg === "--limit" || arg === "-l") {
      const parsed = Number(args[i + 1]);
      options.limit = Number.isFinite(parsed) && parsed > 0 ? parsed : options.limit;
      i += 1;
    } else if (arg === "--all") {
      options.qualityOnly = false;
    } else if (arg === "--quality-only") {
      options.qualityOnly = true;
    } else if (arg === "--help" || arg === "-h") {
      console.log(`
Usage: npm run stats:rank -- [options]

Options:
  -l, --limit <number>   Number of rows to rank per metric (default: ${DEFAULT_LIMIT})
  --quality-only         Only rank quality candidate universes (default)
  --all                  Rank all universes
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
