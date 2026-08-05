import "../shared/load-env";

import { supabaseAdmin } from "@/lib/supabase-admin";
import { finishStatsJobRun, startStatsJobRun } from "../shared/stats-job-run";
import { addHours, chunkArray, fetchResaleDataResult, normalizeNumber, readNumber, toBoolean } from "./item-stats-utils";

type ResaleCandidate = {
  asset_id: number;
  item_type: string | null;
  last_resale_data_fetched_at: string | null;
};

type Options = {
  limit: number;
  maxAgeHours: number;
  dryRun: boolean;
};

const USER_AGENT = process.env.ROBLOX_ITEM_STATS_USER_AGENT ?? "BloxodesItemStatsBot/1.0";
const REQUEST_MIN_MS = readNumber(process.env.ROBLOX_ITEM_RESALE_MIN_REQUEST_MS, 1500);
const MAX_RETRIES = readNumber(process.env.ROBLOX_ITEM_RESALE_MAX_RETRIES, 3);

function parseArgs(): Options {
  const args = process.argv.slice(2);
  const options: Options = {
    limit: readNumber(process.env.ROBLOX_ITEM_RESALE_LIMIT, 100),
    maxAgeHours: readNumber(process.env.ROBLOX_ITEM_RESALE_MAX_AGE_HOURS, 24),
    dryRun: toBoolean(process.env.ROBLOX_ITEM_RESALE_DRY_RUN, false)
  };

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (arg === "--limit") {
      options.limit = readNumber(args[index + 1], options.limit);
      index += 1;
    } else if (arg === "--max-age-hours") {
      options.maxAgeHours = readNumber(args[index + 1], options.maxAgeHours);
      index += 1;
    } else if (arg === "--dry-run") {
      options.dryRun = true;
    } else if (arg === "--help" || arg === "-h") {
      console.log(`
Usage: npm run stats:items:resale -- [--limit <n>] [--max-age-hours <n>] [--dry-run]

Fetches Roblox public resale price/volume history for resale-capable items.
`);
      process.exit(0);
    }
  }

  return options;
}

async function loadCandidates(options: Options): Promise<ResaleCandidate[]> {
  const cutoff = new Date(Date.now() - options.maxAgeHours * 60 * 60 * 1000).toISOString();
  const { data, error } = await supabaseAdmin()
    .from("roblox_catalog_items")
    .select("asset_id,item_type,last_resale_data_fetched_at")
    .eq("is_deleted", false)
    .eq("item_type", "Asset")
    .gt("asset_id", 0)
    .or("has_resellers.eq.true,lowest_resale_price_robux.gt.0")
    .or(`last_resale_data_fetched_at.is.null,last_resale_data_fetched_at.lt.${cutoff}`)
    .order("last_resale_data_fetched_at", { ascending: true, nullsFirst: true })
    .order("lowest_resale_price_robux", { ascending: false, nullsFirst: false })
    .limit(options.limit);

  if (error) throw new Error(`Failed to load resale candidates: ${error.message}`);
  return (data ?? []) as ResaleCandidate[];
}

async function upsertRows(table: string, rows: Record<string, unknown>[], onConflict: string, size = 250) {
  for (const chunk of chunkArray(rows, size)) {
    const { error } = await supabaseAdmin().from(table).upsert(chunk, { onConflict });
    if (error) throw new Error(`Failed to upsert ${table}: ${error.message}`);
  }
}

async function main() {
  const options = parseArgs();
  const run = await startStatsJobRun({
    jobName: "stats_items_resale_history",
    metadata: { limit: options.limit, max_age_hours: options.maxAgeHours, dry_run: options.dryRun }
  });

  try {
    const candidates = await loadCandidates(options);
    const nowIso = new Date().toISOString();
    const pointRows: Record<string, unknown>[] = [];
    const itemUpdates: Record<string, unknown>[] = [];
    let skipped = 0;
    let failed = 0;
    const failures: Array<{ assetId: number; error: string }> = [];

    for (const candidate of candidates) {
      let result: Awaited<ReturnType<typeof fetchResaleDataResult>>;
      try {
        result = await fetchResaleDataResult(candidate.asset_id, {
          userAgent: USER_AGENT,
          minRequestMs: REQUEST_MIN_MS,
          maxRetries: MAX_RETRIES
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        console.warn(`Resale data failed for ${candidate.asset_id}: ${message}`);
        failed += 1;
        failures.push({ assetId: candidate.asset_id, error: message });
        itemUpdates.push({
          asset_id: candidate.asset_id,
          last_item_stats_refresh_error: message,
          next_item_stats_refresh_at: addHours(nowIso, 6)
        });
        continue;
      }
      const payload = result.payload;

      if (result.kind === "unsupported" || (!payload?.priceDataPoints?.length && !payload?.volumeDataPoints?.length)) {
        skipped += 1;
        itemUpdates.push({
          asset_id: candidate.asset_id,
          last_resale_data_fetched_at: nowIso,
          last_item_stats_refresh_error: payload?.errors?.[0]?.message ?? null,
          next_item_stats_refresh_at: addHours(nowIso, 24)
        });
        continue;
      }

      const volumeByDate = new Map<string, number | null>();
      for (const point of payload.volumeDataPoints ?? []) {
        if (!point.date) continue;
        volumeByDate.set(point.date.slice(0, 10), normalizeNumber(point.value));
      }

      for (const point of payload.priceDataPoints ?? []) {
        if (!point.date) continue;
        const date = point.date.slice(0, 10);
        pointRows.push({
          asset_id: candidate.asset_id,
          point_date: date,
          resale_price_robux: normalizeNumber(point.value),
          resale_volume: volumeByDate.get(date) ?? null,
          fetched_at: nowIso
        });
      }

      itemUpdates.push({
        asset_id: candidate.asset_id,
        last_resale_data_fetched_at: nowIso,
        rap_price_points: payload.priceDataPoints ?? [],
        rap_volume_points: payload.volumeDataPoints ?? [],
        rap_last_fetched: nowIso,
        last_item_stats_refresh_error: null
      });
    }

    if (!options.dryRun) {
      await upsertRows("roblox_catalog_item_resale_points", pointRows, "asset_id,point_date", 500);
      await upsertRows("roblox_catalog_items", itemUpdates, "asset_id", 100);
    }

    const status = failed === 0 ? "success" : candidates.length - failed > 0 ? "partial" : "failed";
    await finishStatsJobRun(run, {
      status,
      rowsClaimed: candidates.length,
      rowsSucceeded: candidates.length - skipped - failed,
      rowsFailed: failed,
      metadata: { point_rows: pointRows.length, unsupported_or_empty: skipped, failures: failures.slice(0, 20), dry_run: options.dryRun }
    });

    console.log(JSON.stringify({ status, dryRun: options.dryRun, candidates: candidates.length, pointRows: pointRows.length, skipped, failed }, null, 2));
    if (status === "failed") process.exitCode = 1;
  } catch (error) {
    await finishStatsJobRun(run, { status: "failed", error });
    throw error;
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
