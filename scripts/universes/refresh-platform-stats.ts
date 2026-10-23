import "../shared/load-env";

import { supabaseAdmin } from "@/lib/supabase-admin";
import { finishStatsJobRun, startStatsJobRun } from "../shared/stats-job-run";

const DEFAULT_HOURLY_DAYS = readPositiveInteger("PLATFORM_STATS_HOURLY_DAYS", 2);
const DEFAULT_DAILY_DAYS = readPositiveInteger("PLATFORM_STATS_DAILY_DAYS", 2);

type Options = {
  hourlyDays: number;
  hourlyHours: number | null;
  dailyDays: number;
  skipDaily: boolean;
};

function readPositiveInteger(name: string, fallback: number) {
  const raw = process.env[name];
  if (!raw) return fallback;
  const parsed = Number(raw);
  return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : fallback;
}

function daysAgoIso(days: number) {
  const date = new Date();
  date.setUTCDate(date.getUTCDate() - days);
  date.setUTCMinutes(0, 0, 0);
  return date.toISOString();
}

function hoursAgoIso(hours: number) {
  const date = new Date(Date.now() - hours * 60 * 60 * 1000);
  date.setUTCMinutes(0, 0, 0);
  return date.toISOString();
}

function daysAgoDate(days: number) {
  return daysAgoIso(days).slice(0, 10);
}

function parseArgs(): Options {
  const args = process.argv.slice(2);
  const options: Options = {
    hourlyDays: DEFAULT_HOURLY_DAYS,
    hourlyHours: null,
    dailyDays: DEFAULT_DAILY_DAYS,
    skipDaily: false
  };

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (arg === "--hourly-days") {
      const parsed = Number(args[index + 1]);
      options.hourlyDays = Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : options.hourlyDays;
      index += 1;
    } else if (arg === "--hourly-hours") {
      const parsed = Number(args[index + 1]);
      options.hourlyHours = Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : options.hourlyHours;
      index += 1;
    } else if (arg === "--skip-daily") {
      options.skipDaily = true;
    } else if (arg === "--daily-days") {
      const parsed = Number(args[index + 1]);
      options.dailyDays = Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : options.dailyDays;
      index += 1;
    } else if (arg === "--help" || arg === "-h") {
      console.log(`
Usage: npm run stats:platform:refresh -- [options]

Options:
  --hourly-days <number>  Hourly aggregate window to refresh (default: ${DEFAULT_HOURLY_DAYS})
  --hourly-hours <number> Hourly aggregate window in hours; overrides --hourly-days
  --daily-days <number>   Daily aggregate window to refresh (default: ${DEFAULT_DAILY_DAYS})
  --skip-daily            Refresh only the hourly aggregate
  -h, --help              Show this help text
`);
      process.exit(0);
    }
  }

  return options;
}

async function refreshHourly(sinceIso: string) {
  const { data, error } = await supabaseAdmin().rpc("refresh_roblox_platform_stats_hourly", {
    p_since: sinceIso
  });
  if (error) throw error;
  return Number(data ?? 0);
}

async function refreshDaily(sinceDate: string) {
  const { data, error } = await supabaseAdmin().rpc("refresh_roblox_platform_stats_daily", {
    p_since: sinceDate
  });
  if (error) throw error;
  return Number(data ?? 0);
}

async function main() {
  const options = parseArgs();
  // A short hourly window keeps each call far below the API statement timeout,
  // so the frequent VPS run can keep the 24-hour chart current.
  const hourlySince = options.hourlyHours ? hoursAgoIso(options.hourlyHours) : daysAgoIso(options.hourlyDays);
  const dailySince = options.skipDaily ? null : daysAgoDate(options.dailyDays);
  const run = await startStatsJobRun({
    jobName: "stats_platform_refresh",
    metadata: {
      hourly_days: options.hourlyHours ? null : options.hourlyDays,
      hourly_hours: options.hourlyHours,
      daily_days: options.skipDaily ? null : options.dailyDays,
      hourly_since: hourlySince,
      daily_since: dailySince
    }
  });

  try {
    // Keep each aggregate bounded and observable. Running both RPCs together
    // previously left a partial daily write when the oversized hourly scan
    // timed out, while the job could report only one combined failure.
    const hourlyRows = await refreshHourly(hourlySince);
    const dailyRows = dailySince ? await refreshDaily(dailySince) : 0;
    await finishStatsJobRun(run, {
      status: "success",
      rowsClaimed: hourlyRows + dailyRows,
      rowsSucceeded: hourlyRows + dailyRows,
      metadata: {
        hourly_rows: hourlyRows,
        daily_rows: dailyRows,
        hourly_since: hourlySince,
        daily_since: dailySince
      }
    });
    console.log(JSON.stringify({ hourlyRows, dailyRows, hourlySince, dailySince }, null, 2));
  } catch (error) {
    await finishStatsJobRun(run, { status: "failed", error, metadata: { hourly_since: hourlySince, daily_since: dailySince } });
    throw error;
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
