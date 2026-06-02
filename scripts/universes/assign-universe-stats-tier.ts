import "../shared/load-env";

import { supabaseAdmin } from "@/lib/supabase-admin";
import { assignStatsTier, isStatsTier, type StatsTier } from "./stats-tier";

const DEFAULT_LIMIT = Number(process.env.UNIVERSE_STATS_TIER_LIMIT ?? "0");
const BATCH_SIZE = Number(process.env.UNIVERSE_STATS_TIER_BATCH ?? "500");

type Options = {
  limit: number;
  tier: StatsTier | "ALL";
};

type UniverseRow = {
  universe_id: number;
  playing: number | null;
  visits: number | null;
  stats_tier: StatsTier | null;
  last_stats_refreshed_at: string | null;
};

async function fetchPage(options: Options, offset: number, count: number): Promise<UniverseRow[]> {
  let query = supabaseAdmin()
    .from("roblox_universes")
    .select("universe_id, playing, visits, stats_tier, last_stats_refreshed_at")
    .not("root_place_id", "is", null)
    .order("universe_id", { ascending: true })
    .range(offset, offset + count - 1);

  if (options.tier !== "ALL") {
    query = query.eq("stats_tier", options.tier);
  }

  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []) as UniverseRow[];
}

async function writeRows(rows: UniverseRow[]) {
  const now = new Date().toISOString();
  let changed = 0;
  for (const row of rows) {
    const next = assignStatsTier({
      playing: row.playing,
      visits: row.visits,
      lastStatsRefreshedAt: row.last_stats_refreshed_at
    });
    if (row.stats_tier === next.tier) continue;
    const { error } = await supabaseAdmin()
      .from("roblox_universes")
      .update({
        stats_tier: next.tier,
        stats_tier_reason: next.reason,
        stats_tier_updated_at: now
      })
      .eq("universe_id", row.universe_id);
    if (error) throw error;
    changed += 1;
  }
  return changed;
}

function parseArgs(): Options {
  const args = process.argv.slice(2);
  const options: Options = {
    limit: Number.isFinite(DEFAULT_LIMIT) && DEFAULT_LIMIT > 0 ? DEFAULT_LIMIT : 0,
    tier: "ALL"
  };

  for (let i = 0; i < args.length; i += 1) {
    const arg = args[i];
    if (arg === "--limit" || arg === "-l") {
      const parsed = Number(args[i + 1]);
      options.limit = Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
      i += 1;
    } else if (arg === "--tier") {
      const tier = String(args[i + 1] ?? "").toUpperCase();
      if (tier === "ALL" || isStatsTier(tier)) {
        options.tier = tier;
      } else {
        throw new Error(`Invalid --tier value: ${tier}. Use NEW, HOT, WARM, COLD, or ALL.`);
      }
      i += 1;
    } else if (arg === "--help" || arg === "-h") {
      console.log(`
Usage: npm run stats:tier -- [options]

Options:
  -l, --limit <number>  Max universes to inspect; 0 means all
  --tier <tier>         Only reassign rows currently in NEW, HOT, WARM, COLD, or ALL
  -h, --help            Show this help text
`);
      process.exit(0);
    }
  }

  return options;
}

async function main() {
  const options = parseArgs();
  let offset = 0;
  let inspected = 0;
  let changed = 0;

  while (true) {
    if (options.limit > 0 && inspected >= options.limit) break;
    const count = options.limit > 0 ? Math.min(BATCH_SIZE, options.limit - inspected) : BATCH_SIZE;
    const rows = await fetchPage(options, offset, count);
    if (!rows.length) break;
    changed += await writeRows(rows);
    inspected += rows.length;
    offset += rows.length;
    console.log(`Inspected ${inspected} universes; changed ${changed} tiers.`);
    if (rows.length < count) break;
  }

  console.log(`Done. Inspected ${inspected} universes; changed ${changed} tiers.`);
}

main().catch((error) => {
  console.error("Stats tier assignment failed:", error instanceof Error ? error.message : error);
  process.exit(1);
});
