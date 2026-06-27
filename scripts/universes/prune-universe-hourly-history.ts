import "../shared/load-env";

import { supabaseAdmin } from "@/lib/supabase-admin";
import { finishStatsJobRun, startStatsJobRun } from "../shared/stats-job-run";

const DEFAULT_DAYS = readPositiveInteger("UNIVERSE_HOURLY_HISTORY_RETENTION_DAYS", 90);
const DEFAULT_BATCH_SIZE = readPositiveInteger("UNIVERSE_HOURLY_HISTORY_PRUNE_BATCH_SIZE", 5000);
const DEFAULT_MAX_BATCHES = readPositiveInteger("UNIVERSE_HOURLY_HISTORY_PRUNE_MAX_BATCHES", 100);

type Options = {
  days: number;
  batchSize: number;
  maxBatches: number;
  apply: boolean;
};

type PruneResult = {
  stats_deleted?: number;
  rank_deleted?: number;
  cutoff?: string;
};

function readPositiveInteger(name: string, fallback: number) {
  const raw = process.env[name];
  if (!raw) return fallback;
  const parsed = Number(raw);
  return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : fallback;
}

function cutoffIso(days: number) {
  const date = new Date();
  date.setUTCDate(date.getUTCDate() - days);
  date.setUTCMinutes(0, 0, 0);
  return date.toISOString();
}

function parseArgs(): Options {
  const args = process.argv.slice(2);
  const options: Options = {
    days: DEFAULT_DAYS,
    batchSize: DEFAULT_BATCH_SIZE,
    maxBatches: DEFAULT_MAX_BATCHES,
    apply: false
  };

  for (let i = 0; i < args.length; i += 1) {
    const arg = args[i];
    if (arg === "--days") {
      const parsed = Number(args[i + 1]);
      options.days = Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : options.days;
      i += 1;
    } else if (arg === "--batch-size") {
      const parsed = Number(args[i + 1]);
      options.batchSize = Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : options.batchSize;
      i += 1;
    } else if (arg === "--max-batches") {
      const parsed = Number(args[i + 1]);
      options.maxBatches = Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : options.maxBatches;
      i += 1;
    } else if (arg === "--apply") {
      options.apply = true;
    } else if (arg === "--dry-run") {
      options.apply = false;
    } else if (arg === "--help" || arg === "-h") {
      console.log(`
Usage: npm run stats:prune-hourly -- [options]

Options:
  --days <number>          Retention window in days (default: ${DEFAULT_DAYS})
  --batch-size <number>    Rows to delete per table per batch (default: ${DEFAULT_BATCH_SIZE})
  --max-batches <number>   Max prune batches per run (default: ${DEFAULT_MAX_BATCHES})
  --apply                  Delete rows. Without this, only counts matching rows.
  --dry-run                Count rows without deleting.
  -h, --help               Show this help text
`);
      process.exit(0);
    }
  }

  return options;
}

async function countOldRows(table: string, column: string, cutoff: string) {
  const { count, error } = await supabaseAdmin()
    .from(table)
    .select("*", { count: "exact", head: true })
    .lt(column, cutoff);
  if (error) throw error;
  return count ?? 0;
}

async function pruneBatch(cutoff: string, batchSize: number): Promise<PruneResult> {
  const { data, error } = await supabaseAdmin().rpc("prune_roblox_universe_hourly_history", {
    p_cutoff: cutoff,
    p_batch_size: batchSize
  });
  if (error) throw error;
  return (data ?? {}) as PruneResult;
}

async function main() {
  const options = parseArgs();
  const cutoff = cutoffIso(options.days);
  const run = await startStatsJobRun({
    jobName: "stats_universe_hourly_prune",
    metadata: {
      days: options.days,
      batch_size: options.batchSize,
      max_batches: options.maxBatches,
      apply: options.apply,
      cutoff
    }
  });

  try {
    if (!options.apply) {
      const [statsCount, rankCount] = await Promise.all([
        countOldRows("roblox_universe_stats_hourly", "hour_start", cutoff),
        countOldRows("roblox_universe_rank_snapshots_hourly", "hour_start", cutoff)
      ]);
      await finishStatsJobRun(run, {
        status: "skipped",
        rowsClaimed: statsCount + rankCount,
        rowsSucceeded: 0,
        metadata: { cutoff, stats_count: statsCount, rank_count: rankCount, dry_run: true }
      });
      console.log(`Dry run. Cutoff=${cutoff}`);
      console.log(`Hourly stats rows older than cutoff: ${statsCount}`);
      console.log(`Hourly rank rows older than cutoff: ${rankCount}`);
      return;
    }

    let totalStatsDeleted = 0;
    let totalRankDeleted = 0;
    let batchesRun = 0;
    for (let batch = 1; batch <= options.maxBatches; batch += 1) {
      const result = await pruneBatch(cutoff, options.batchSize);
      const statsDeleted = result.stats_deleted ?? 0;
      const rankDeleted = result.rank_deleted ?? 0;
      totalStatsDeleted += statsDeleted;
      totalRankDeleted += rankDeleted;
      batchesRun = batch;
      console.log(`Batch ${batch}: deleted stats=${statsDeleted}, ranks=${rankDeleted}`);
      if (statsDeleted < options.batchSize && rankDeleted < options.batchSize) break;
    }

    await finishStatsJobRun(run, {
      status: "success",
      rowsClaimed: totalStatsDeleted + totalRankDeleted,
      rowsSucceeded: totalStatsDeleted + totalRankDeleted,
      metadata: {
        cutoff,
        stats_deleted: totalStatsDeleted,
        rank_deleted: totalRankDeleted,
        batches_run: batchesRun
      }
    });
    console.log(`Done. Cutoff=${cutoff}, deleted stats=${totalStatsDeleted}, ranks=${totalRankDeleted}`);
  } catch (error) {
    await finishStatsJobRun(run, { status: "failed", error, metadata: { cutoff } });
    throw error;
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
