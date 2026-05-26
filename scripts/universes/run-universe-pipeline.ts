import "../shared/load-env";

import { spawn } from "node:child_process";

type Options = {
  allowLive: boolean;
  seed: boolean;
  seedContent: boolean;
  searchJobs: number;
  searchPages: number;
  creatorJobs: number;
  creatorPages: number;
  creatorSeedLimit: number;
  creatorQualityOnly: boolean;
  lightLimit: number;
  scoreLimit: number;
  playingLimit: number;
  statsLimit: number;
  deepLimit: number;
  refreshLists: boolean;
  skipSearch: boolean;
  skipCreators: boolean;
  skipLight: boolean;
  skipScore: boolean;
};

type Step = {
  name: string;
  args: string[];
  enabled: boolean;
};

function readNumber(value: string | undefined, fallback: number) {
  if (!value) return fallback;
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? Math.floor(parsed) : fallback;
}

function parseArgs(): Options {
  const args = process.argv.slice(2);
  const options: Options = {
    allowLive: false,
    seed: true,
    seedContent: true,
    searchJobs: readNumber(process.env.UNIVERSE_PIPELINE_SEARCH_JOBS, 100),
    searchPages: readNumber(process.env.UNIVERSE_PIPELINE_SEARCH_PAGES, 2),
    creatorJobs: readNumber(process.env.UNIVERSE_PIPELINE_CREATOR_JOBS, 50),
    creatorPages: readNumber(process.env.UNIVERSE_PIPELINE_CREATOR_PAGES, 3),
    creatorSeedLimit: readNumber(process.env.UNIVERSE_PIPELINE_CREATOR_SEED_LIMIT, 1000),
    creatorQualityOnly: process.env.UNIVERSE_PIPELINE_CREATOR_QUALITY_ONLY === "true",
    lightLimit: readNumber(process.env.UNIVERSE_PIPELINE_LIGHT_LIMIT, 500),
    scoreLimit: readNumber(process.env.UNIVERSE_PIPELINE_SCORE_LIMIT, 1000),
    playingLimit: readNumber(process.env.UNIVERSE_PIPELINE_PLAYING_LIMIT, 0),
    statsLimit: readNumber(process.env.UNIVERSE_PIPELINE_STATS_LIMIT, 0),
    deepLimit: readNumber(process.env.UNIVERSE_PIPELINE_DEEP_LIMIT, 0),
    refreshLists: false,
    skipSearch: false,
    skipCreators: false,
    skipLight: false,
    skipScore: false
  };

  for (let i = 0; i < args.length; i += 1) {
    const arg = args[i];
    if (arg === "--allow-live") {
      options.allowLive = true;
    } else if (arg === "--no-seed") {
      options.seed = false;
      options.seedContent = false;
    } else if (arg === "--no-content-seed") {
      options.seedContent = false;
    } else if (arg === "--search-jobs") {
      options.searchJobs = readNumber(args[i + 1], options.searchJobs);
      i += 1;
    } else if (arg === "--search-pages") {
      options.searchPages = readNumber(args[i + 1], options.searchPages);
      i += 1;
    } else if (arg === "--creator-jobs") {
      options.creatorJobs = readNumber(args[i + 1], options.creatorJobs);
      i += 1;
    } else if (arg === "--creator-pages") {
      options.creatorPages = readNumber(args[i + 1], options.creatorPages);
      i += 1;
    } else if (arg === "--creator-seed-limit") {
      options.creatorSeedLimit = readNumber(args[i + 1], options.creatorSeedLimit);
      i += 1;
    } else if (arg === "--quality-creators-only") {
      options.creatorQualityOnly = true;
    } else if (arg === "--light-limit") {
      options.lightLimit = readNumber(args[i + 1], options.lightLimit);
      i += 1;
    } else if (arg === "--score-limit") {
      options.scoreLimit = readNumber(args[i + 1], options.scoreLimit);
      i += 1;
    } else if (arg === "--playing-limit") {
      options.playingLimit = readNumber(args[i + 1], options.playingLimit);
      i += 1;
    } else if (arg === "--stats-limit") {
      options.statsLimit = readNumber(args[i + 1], options.statsLimit);
      i += 1;
    } else if (arg === "--deep-limit") {
      options.deepLimit = readNumber(args[i + 1], options.deepLimit);
      i += 1;
    } else if (arg === "--refresh-lists") {
      options.refreshLists = true;
    } else if (arg === "--skip-search") {
      options.skipSearch = true;
    } else if (arg === "--skip-creators") {
      options.skipCreators = true;
    } else if (arg === "--skip-light") {
      options.skipLight = true;
    } else if (arg === "--skip-score") {
      options.skipScore = true;
    } else if (arg === "--help" || arg === "-h") {
      printHelp();
      process.exit(0);
    }
  }

  return options;
}

function printHelp() {
  console.log(`
Usage: npm run pipeline:universes -- [options]

Local-safe orchestration for the universe discovery pipeline.

Options:
  --allow-live              Allow non-local SUPABASE_URL targets
  --no-seed                 Do not seed default search jobs this run
  --no-content-seed         Do not seed search jobs from existing site content
  --search-jobs <number>    Pending search jobs to process (default: 100)
  --search-pages <number>   Search pages per job (default: 2)
  --creator-jobs <number>   Creator/group expansion jobs to process (default: 50)
  --creator-pages <number>  Creator game pages per job (default: 3)
  --creator-seed-limit <n>  Universe rows to inspect when seeding creator jobs (default: 1000)
  --quality-creators-only   Seed creator expansion only from A/B quality candidates
  --light-limit <number>    Light enrichment limit; 0 skips (default: 500)
  --score-limit <number>    Quality scoring limit; 0 scores all (default: 1000)
  --playing-limit <number>  Legacy alias for hourly public stats limit; 0 skips
  --stats-limit <number>    Update hourly public stats and today's daily rollup; 0 skips
  --deep-limit <number>     Deep-enrich top quality rows; 0 skips
  --refresh-lists           Refresh game lists at the end
  --skip-search             Skip search discovery
  --skip-creators           Skip creator/group expansion
  --skip-light              Skip light enrichment
  --skip-score              Skip quality scoring
  -h, --help                Show this help text
`);
}

function isLocalSupabaseUrl(value: string | undefined) {
  if (!value) return false;
  return /^https?:\/\/(localhost|127\.0\.0\.1|\[::1\])(?::\d+)?/i.test(value);
}

function assertSafeTarget(options: Options) {
  if (options.allowLive) return;
  if (isLocalSupabaseUrl(process.env.SUPABASE_URL)) return;
  throw new Error(
    `Refusing to run universe pipeline against non-local SUPABASE_URL (${process.env.SUPABASE_URL ?? "unset"}). Use --allow-live when intentionally running outside local Supabase.`
  );
}

function npmStep(name: string, script: string, args: string[], enabled: boolean): Step {
  return {
    name,
    enabled,
    args: ["run", script, "--", ...args]
  };
}

function buildSteps(options: Options): Step[] {
  const hourlyStatsLimit = Math.max(options.statsLimit, options.playingLimit);
  return [
    npmStep(
      "Search discovery",
      "search:universes",
      [
        ...(options.seed ? ["--seed"] : []),
        ...(options.seedContent ? ["--seed-content"] : []),
        "--limit",
        String(options.searchJobs),
        "--max-pages",
        String(options.searchPages)
      ],
      !options.skipSearch && options.searchJobs >= 0
    ),
    npmStep(
      "Light enrichment",
      "enrich:universes:light",
      ["--limit", String(options.lightLimit)],
      !options.skipLight && options.lightLimit > 0
    ),
    npmStep(
      "Quality scoring",
      "score:universes",
      ["--limit", String(options.scoreLimit)],
      !options.skipScore
    ),
    npmStep(
      "Creator expansion",
      "expand:creators",
      [
        ...(options.seed ? ["--seed"] : []),
        ...(options.creatorQualityOnly ? ["--quality-creators-only"] : []),
        "--seed-limit",
        String(options.creatorSeedLimit),
        "--limit",
        String(options.creatorJobs),
        "--max-pages",
        String(options.creatorPages)
      ],
      !options.skipCreators && options.creatorJobs >= 0
    ),
    npmStep(
      "Hourly stats refresh",
      "update:hourly-stats",
      ["--quality-only", "--rollup-today", "--limit", String(hourlyStatsLimit)],
      hourlyStatsLimit > 0
    ),
    npmStep(
      "Stats rank snapshots",
      "stats:rank",
      ["--quality-only", "--limit", String(Math.max(hourlyStatsLimit, 250))],
      hourlyStatsLimit > 0
    ),
    npmStep(
      "Deep enrichment",
      "enrich:universes:deep",
      ["--quality-only", "--limit", String(options.deepLimit)],
      options.deepLimit > 0
    ),
    npmStep("List refresh", "lists:refresh", [], options.refreshLists)
  ];
}

function runStep(step: Step): Promise<void> {
  return new Promise((resolve, reject) => {
    console.log(`\n▶ ${step.name}: npm ${step.args.join(" ")}`);
    const child = spawn("npm", step.args, {
      cwd: process.cwd(),
      env: process.env,
      stdio: "inherit"
    });
    child.on("error", reject);
    child.on("exit", (code) => {
      if (code === 0) resolve();
      else reject(new Error(`${step.name} exited with code ${code}`));
    });
  });
}

async function main() {
  const options = parseArgs();
  assertSafeTarget(options);
  const steps = buildSteps(options).filter((step) => step.enabled);
  if (!steps.length) {
    console.log("No universe pipeline steps enabled.");
    return;
  }

  console.log(`Running universe pipeline against ${process.env.SUPABASE_URL}`);
  for (const step of steps) {
    await runStep(step);
  }
  console.log("\nUniverse pipeline complete.");
}

main().catch((error) => {
  console.error("Universe pipeline failed:", error instanceof Error ? error.message : error);
  process.exit(1);
});
