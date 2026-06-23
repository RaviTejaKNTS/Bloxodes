import "../shared/load-env";

import { supabaseAdmin } from "@/lib/supabase-admin";
import { finishStatsJobRun, startStatsJobRun } from "../shared/stats-job-run";
import { chunkArray, isoDate, readNumber } from "./item-stats-utils";

type Options = {
  date: string;
  finalize: boolean;
  limit: number;
};

type HourlyRow = {
  asset_id: number;
  hour_start: string;
  sampled_at: string;
  price_robux: number | null;
  lowest_resale_price_robux: number | null;
  favorite_count: number | null;
  units_available_for_consumption: number | null;
};

function dateOffset(days: number) {
  const date = new Date();
  date.setUTCDate(date.getUTCDate() + days);
  return isoDate(date);
}

function parseDate(value: string | undefined) {
  if (!value || value === "today") return isoDate();
  if (value === "yesterday") return dateOffset(-1);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) throw new Error(`Invalid date "${value}". Use YYYY-MM-DD, today, or yesterday.`);
  return value;
}

function parseArgs(): Options {
  const args = process.argv.slice(2);
  const options: Options = {
    date: parseDate(process.env.ITEM_STATS_ROLLUP_DATE ?? "yesterday"),
    finalize: false,
    limit: readNumber(process.env.ITEM_STATS_ROLLUP_LIMIT, 0)
  };

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (arg === "--date") {
      options.date = parseDate(args[index + 1]);
      index += 1;
    } else if (arg === "--finalize") {
      options.finalize = true;
    } else if (arg === "--limit") {
      options.limit = readNumber(args[index + 1], options.limit);
      index += 1;
    } else if (arg === "--help" || arg === "-h") {
      console.log(`
Usage: npm run stats:items:rollup-daily -- [--date yesterday|today|YYYY-MM-DD] [--finalize] [--limit <n>]

Rolls hourly Roblox item snapshots into daily open/close/min/max rows.
`);
      process.exit(0);
    }
  }

  return options;
}

async function loadHourlyRows(options: Options) {
  const start = `${options.date}T00:00:00.000Z`;
  const endDate = new Date(start);
  endDate.setUTCDate(endDate.getUTCDate() + 1);
  const end = endDate.toISOString();
  let from = 0;
  const pageSize = 1000;
  const rows: HourlyRow[] = [];

  while (true) {
    let query = supabaseAdmin()
      .from("roblox_catalog_item_stats_hourly")
      .select("asset_id,hour_start,sampled_at,price_robux,lowest_resale_price_robux,favorite_count,units_available_for_consumption")
      .gte("hour_start", start)
      .lt("hour_start", end)
      .order("asset_id", { ascending: true })
      .order("hour_start", { ascending: true })
      .range(from, from + pageSize - 1);

    if (options.limit > 0) query = query.limit(Math.min(pageSize, options.limit - rows.length));
    const { data, error } = await query;
    if (error) throw new Error(`Failed to load hourly item rows: ${error.message}`);
    rows.push(...((data ?? []) as HourlyRow[]));
    if ((data?.length ?? 0) < pageSize || (options.limit > 0 && rows.length >= options.limit)) break;
    from += pageSize;
  }

  return rows;
}

function firstNumber(rows: HourlyRow[], key: keyof HourlyRow) {
  for (const row of rows) {
    const value = row[key];
    if (typeof value === "number" && Number.isFinite(value)) return value;
  }
  return null;
}

function lastNumber(rows: HourlyRow[], key: keyof HourlyRow) {
  for (let index = rows.length - 1; index >= 0; index -= 1) {
    const value = rows[index][key];
    if (typeof value === "number" && Number.isFinite(value)) return value;
  }
  return null;
}

function minNumber(rows: HourlyRow[], key: keyof HourlyRow) {
  const values = rows.map((row) => row[key]).filter((value): value is number => typeof value === "number" && Number.isFinite(value));
  return values.length ? Math.min(...values) : null;
}

function maxNumber(rows: HourlyRow[], key: keyof HourlyRow) {
  const values = rows.map((row) => row[key]).filter((value): value is number => typeof value === "number" && Number.isFinite(value));
  return values.length ? Math.max(...values) : null;
}

function buildDailyRows(rows: HourlyRow[], options: Options) {
  const byAssetId = new Map<number, HourlyRow[]>();
  for (const row of rows) {
    const bucket = byAssetId.get(row.asset_id) ?? [];
    bucket.push(row);
    byAssetId.set(row.asset_id, bucket);
  }

  return Array.from(byAssetId.entries()).map(([assetId, assetRows]) => {
    const orderedRows = [...assetRows].sort((a, b) => Date.parse(a.hour_start) - Date.parse(b.hour_start));
    const favoritesOpen = firstNumber(orderedRows, "favorite_count");
    const favoritesClose = lastNumber(orderedRows, "favorite_count");
    return {
      asset_id: assetId,
      stat_date: options.date,
      sample_count: orderedRows.length,
      price_open: firstNumber(orderedRows, "price_robux"),
      price_close: lastNumber(orderedRows, "price_robux"),
      price_min: minNumber(orderedRows, "price_robux"),
      price_max: maxNumber(orderedRows, "price_robux"),
      resale_open: firstNumber(orderedRows, "lowest_resale_price_robux"),
      resale_close: lastNumber(orderedRows, "lowest_resale_price_robux"),
      resale_min: minNumber(orderedRows, "lowest_resale_price_robux"),
      resale_max: maxNumber(orderedRows, "lowest_resale_price_robux"),
      favorites_open: favoritesOpen,
      favorites_close: favoritesClose,
      favorites_delta: favoritesOpen != null && favoritesClose != null ? favoritesClose - favoritesOpen : null,
      units_available_min: minNumber(orderedRows, "units_available_for_consumption"),
      units_available_close: lastNumber(orderedRows, "units_available_for_consumption"),
      last_sampled_at: orderedRows[orderedRows.length - 1]?.sampled_at ?? null,
      finalized: options.finalize
    };
  });
}

async function upsertDailyRows(rows: Record<string, unknown>[]) {
  for (const chunk of chunkArray(rows, 500)) {
    const { error } = await supabaseAdmin().from("roblox_catalog_item_stats_daily").upsert(chunk, { onConflict: "asset_id,stat_date" });
    if (error) throw new Error(`Failed to upsert item daily rollups: ${error.message}`);
  }
}

async function main() {
  const options = parseArgs();
  const run = await startStatsJobRun({
    jobName: "stats_items_daily_rollup",
    metadata: { date: options.date, finalize: options.finalize, limit: options.limit }
  });

  try {
    const hourlyRows = await loadHourlyRows(options);
    const dailyRows = buildDailyRows(hourlyRows, options);
    await upsertDailyRows(dailyRows);
    await finishStatsJobRun(run, {
      status: "success",
      rowsClaimed: hourlyRows.length,
      rowsSucceeded: dailyRows.length,
      metadata: { date: options.date, finalized: options.finalize }
    });
    console.log(JSON.stringify({ date: options.date, hourlyRows: hourlyRows.length, dailyRows: dailyRows.length, finalized: options.finalize }, null, 2));
  } catch (error) {
    await finishStatsJobRun(run, { status: "failed", error });
    throw error;
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
