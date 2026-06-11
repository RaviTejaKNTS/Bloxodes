import "../shared/load-env";

import { supabaseAdmin } from "@/lib/supabase-admin";
import { finishStatsJobRun, startStatsJobRun } from "../shared/stats-job-run";

const DEFAULT_LIMIT = readNonNegativeInteger("UNIVERSE_NEW_AUDIT_LIMIT", 5000);
const PAGE_SIZE = 1000;

type NewUniverseRow = {
  universe_id: number;
  root_place_id: number | null;
  slug: string | null;
  playing: number | null;
  visits: number | null;
  favorites: number | null;
  last_stats_refreshed_at: string | null;
  last_light_enriched_at: string | null;
  stats_tier_reason: string | null;
};

type Options = {
  limit: number;
  apply: boolean;
};

function readNonNegativeInteger(name: string, fallback: number) {
  const raw = process.env[name];
  if (!raw) return fallback;
  const parsed = Number(raw);
  return Number.isFinite(parsed) && parsed >= 0 ? Math.floor(parsed) : fallback;
}

function parseArgs(): Options {
  const args = process.argv.slice(2);
  const options: Options = {
    limit: DEFAULT_LIMIT,
    apply: false
  };
  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (arg === "--limit" || arg === "-l") {
      options.limit = readCliNonNegativeInteger(args[index + 1], "limit");
      index += 1;
    } else if (arg === "--apply") {
      options.apply = true;
    } else if (arg === "--help" || arg === "-h") {
      console.log(`
Usage: npm run stats:audit:new -- [--limit <n>] [--apply]

Classifies NEW stats-tier universes so stuck intake rows can be repaired or
excluded intentionally. Without --apply this is read-only.
`);
      process.exit(0);
    } else {
      throw new Error(`Unknown option: ${arg}`);
    }
  }
  return options;
}

function readCliNonNegativeInteger(value: string | undefined, label: string) {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 0) throw new Error(`--${label} must be a non-negative integer`);
  return parsed;
}

function classify(row: NewUniverseRow) {
  if (!row.root_place_id) return "missing_root_place";
  if (!row.slug) return "needs_light_enrichment";
  if (!row.last_light_enriched_at) return "never_light_enriched";
  if (!row.last_stats_refreshed_at) return "never_stats_refreshed";
  if (row.playing == null && row.visits == null && row.favorites == null) return "no_public_stats_returned";
  return "ready_for_tier_recheck";
}

async function fetchNewRows(limit: number) {
  const rows: NewUniverseRow[] = [];
  let offset = 0;
  while (limit <= 0 || rows.length < limit) {
    const pageSize = limit > 0 ? Math.min(PAGE_SIZE, limit - rows.length) : PAGE_SIZE;
    const { data, error } = await supabaseAdmin()
      .from("roblox_universes")
      .select("universe_id, root_place_id, slug, playing, visits, favorites, last_stats_refreshed_at, last_light_enriched_at, stats_tier_reason")
      .eq("stats_tier", "NEW")
      .order("last_stats_refreshed_at", { ascending: true, nullsFirst: true })
      .order("universe_id", { ascending: true })
      .range(offset, offset + pageSize - 1);
    if (error) throw error;
    const chunk = (data ?? []) as NewUniverseRow[];
    rows.push(...chunk);
    if (chunk.length < pageSize) break;
    offset += pageSize;
  }
  return rows;
}

async function applyClassifications(rows: NewUniverseRow[]) {
  const now = new Date().toISOString();
  let updated = 0;
  for (const row of rows) {
    const status = classify(row);
    const { error } = await supabaseAdmin()
      .from("roblox_universes")
      .update({
        stats_ingest_status: status,
        stats_ingest_status_updated_at: now,
        stats_tier_reason: status
      })
      .eq("universe_id", row.universe_id);
    if (error) throw error;
    updated += 1;
  }
  return updated;
}

async function main() {
  const options = parseArgs();
  const run = await startStatsJobRun({
    jobName: "stats_new_tier_audit",
    metadata: { limit: options.limit, apply: options.apply }
  });

  try {
    const rows = await fetchNewRows(options.limit);
    const counts = new Map<string, number>();
    for (const row of rows) {
      const status = classify(row);
      counts.set(status, (counts.get(status) ?? 0) + 1);
    }

    const updated = options.apply ? await applyClassifications(rows) : 0;
    const byStatus = Object.fromEntries([...counts.entries()].sort(([a], [b]) => a.localeCompare(b)));

    await finishStatsJobRun(run, {
      status: "success",
      rowsClaimed: rows.length,
      rowsSucceeded: updated,
      metadata: { by_status: byStatus, apply: options.apply }
    });

    console.log("NEW tier audit:", JSON.stringify({ inspected: rows.length, updated, byStatus }, null, 2));
  } catch (error) {
    await finishStatsJobRun(run, { status: "failed", error });
    throw error;
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
