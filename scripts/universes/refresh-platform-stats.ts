import "../shared/load-env";

import { pathToFileURL } from "node:url";

import { supabaseAdmin } from "@/lib/supabase-admin";
import { formatDataApiError } from "../shared/data-api-retry";
import { finishStatsJobRun, startStatsJobRun } from "../shared/stats-job-run";
import { refreshVisitShareSummaries } from "./stats-visit-share-summary";

const DEFAULT_HOURLY_DAYS = readPositiveInteger("PLATFORM_STATS_HOURLY_DAYS", 2);
const DEFAULT_DAILY_DAYS = readPositiveInteger("PLATFORM_STATS_DAILY_DAYS", 2);

type Options = {
  hourlyDays: number;
  hourlyHours: number | null;
  dailyDays: number;
  skipDaily: boolean;
  visitShareOnly: boolean;
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
    skipDaily: false,
    visitShareOnly: false
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
    } else if (arg === "--visit-share-only") {
      options.visitShareOnly = true;
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
  --skip-daily            Refresh only the hourly aggregate (also skips visit-share summaries)
  --visit-share-only      Warm/rebuild visit-share summaries without the player-chart aggregates
  -h, --help              Show this help text
`);
      process.exit(0);
    }
  }

  if (options.skipDaily && options.visitShareOnly) throw new Error("Use either --skip-daily or --visit-share-only");
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

// One failed aggregate must not prevent the other chart from refreshing.
// In particular, the legacy daily platform scan can exceed the API timeout.
export async function runPlatformRefreshSteps(steps: Array<{ name: string; run: () => Promise<void> }>) {
  const failures: Error[] = [];
  for (const step of steps) {
    try {
      await step.run();
    } catch (error) {
      console.error(`${step.name} refresh failed`, error);
      failures.push(new Error(`${step.name}: ${formatDataApiError(error)}`));
    }
  }
  if (failures.length) throw new AggregateError(failures, failures.map((error) => error.message).join("; "));
}

async function main() {
  const options = parseArgs();
  // A short hourly window keeps each call far below the API statement timeout,
  // so the frequent VPS run can keep the 24-hour chart current.
  const hourlySince = options.visitShareOnly ? null
    : options.hourlyHours ? hoursAgoIso(options.hourlyHours) : daysAgoIso(options.hourlyDays);
  const dailySince = options.skipDaily || options.visitShareOnly ? null : daysAgoDate(options.dailyDays);
  const run = await startStatsJobRun({
    jobName: "stats_platform_refresh",
    metadata: {
      hourly_days: hourlySince && !options.hourlyHours ? options.hourlyDays : null,
      hourly_hours: hourlySince ? options.hourlyHours : null,
      daily_days: dailySince ? options.dailyDays : null,
      hourly_since: hourlySince,
      daily_since: dailySince,
      visit_share: !options.skipDaily,
      visit_share_only: options.visitShareOnly
    }
  });
  const results: {
    hourlyRows: number;
    dailyRows: number;
    visitShare: Awaited<ReturnType<typeof refreshVisitShareSummaries>> | null;
  } = { hourlyRows: 0, dailyRows: 0, visitShare: null };

  try {
    await runPlatformRefreshSteps([
      ...(hourlySince ? [
        { name: "hourly", run: async () => { results.hourlyRows = await refreshHourly(hourlySince); } }
      ] : []),
      ...(dailySince ? [
        { name: "daily", run: async () => { results.dailyRows = await refreshDaily(dailySince); } }
      ] : []),
      ...(!options.skipDaily ? [
        { name: "visit-share", run: async () => {
          const client = supabaseAdmin();
          results.visitShare = await refreshVisitShareSummaries((name, args) => client.rpc(name, args));
        } }
      ] : [])
    ]);
    const { hourlyRows, dailyRows, visitShare } = results;
    const visitShareRows = visitShare?.rows ?? 0;
    await finishStatsJobRun(run, {
      status: "success",
      rowsClaimed: hourlyRows + dailyRows + visitShareRows,
      rowsSucceeded: hourlyRows + dailyRows + visitShareRows,
      metadata: {
        hourly_rows: hourlyRows,
        daily_rows: dailyRows,
        visit_share: visitShare,
        hourly_since: hourlySince,
        daily_since: dailySince
      }
    });
    console.log(JSON.stringify({ hourlyRows, dailyRows, visitShare, hourlySince, dailySince }, null, 2));
  } catch (error) {
    await finishStatsJobRun(run, {
      status: "failed",
      rowsSucceeded: results.hourlyRows + results.dailyRows + (results.visitShare?.rows ?? 0),
      error,
      metadata: { hourly_since: hourlySince, daily_since: dailySince, ...results }
    });
    throw error;
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  });
}
