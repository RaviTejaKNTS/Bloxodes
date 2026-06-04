import "../shared/load-env";

import { createClient } from "@supabase/supabase-js";
import { Pool } from "pg";

const PLACE_TO_UNIVERSE_API = (placeId: number) =>
  `https://apis.roblox.com/universes/v1/places/${placeId}/universe`;

const DEFAULT_LIMIT = readNonNegativeInteger("ROBLOXGO_RESOLVE_LIMIT", 0);
const DEFAULT_CONCURRENCY = readPositiveInteger("ROBLOXGO_RESOLVE_CONCURRENCY", 25);
const DEFAULT_SELECT_BATCH = readPositiveInteger("ROBLOXGO_RESOLVE_SELECT_BATCH", DEFAULT_CONCURRENCY * 20);
const DEFAULT_RETRY_LIMIT = readNonNegativeInteger("ROBLOXGO_RESOLVE_RETRY_LIMIT", 5);
const DEFAULT_RETRY_BASE_MS = readPositiveInteger("ROBLOXGO_RESOLVE_RETRY_BASE_MS", 1500);
const DEFAULT_RETRY_MAX_MS = readPositiveInteger("ROBLOXGO_RESOLVE_RETRY_MAX_MS", 60000);
const DEFAULT_PROGRESS_EVERY = readPositiveInteger("ROBLOXGO_RESOLVE_PROGRESS_EVERY", 5000);
const PROD_COMPARE_CHUNK_SIZE = readPositiveInteger("ROBLOXGO_PROD_COMPARE_CHUNK_SIZE", 500);

type Options = {
  apply: boolean;
  reportOnly: boolean;
  compareProd: boolean;
  limit: number;
  concurrency: number;
  selectBatch: number;
};

type ResolveResult = {
  place_id: number;
  universe_id: number | null;
  status: "resolved" | "failed";
  last_error: string | null;
};

type StagingCounts = {
  place_rows_total: number;
  resolved_place_rows: number;
  unique_resolved_universes: number;
  failed_place_rows: number;
  pending_place_rows: number;
};

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

function readPositiveInteger(name: string, fallback: number) {
  const raw = process.env[name];
  if (!raw) return fallback;
  const parsed = Number(raw);
  return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : fallback;
}

function readNonNegativeInteger(name: string, fallback: number) {
  const raw = process.env[name];
  if (!raw) return fallback;
  const parsed = Number(raw);
  return Number.isFinite(parsed) && parsed >= 0 ? Math.floor(parsed) : fallback;
}

function parseArgs(): Options {
  const args = process.argv.slice(2);
  const options: Options = {
    apply: false,
    reportOnly: false,
    compareProd: true,
    limit: DEFAULT_LIMIT,
    concurrency: DEFAULT_CONCURRENCY,
    selectBatch: DEFAULT_SELECT_BATCH
  };

  for (let i = 0; i < args.length; i += 1) {
    const arg = args[i];
    if (arg === "--apply") {
      options.apply = true;
    } else if (arg === "--report-only") {
      options.reportOnly = true;
    } else if (arg === "--no-compare-prod") {
      options.compareProd = false;
    } else if (arg === "--limit") {
      options.limit = readCliNonNegativeInteger(args[i + 1], "limit");
      i += 1;
    } else if (arg === "--concurrency") {
      options.concurrency = readCliPositiveInteger(args[i + 1], "concurrency");
      i += 1;
    } else if (arg === "--select-batch") {
      options.selectBatch = readCliPositiveInteger(args[i + 1], "select-batch");
      i += 1;
    } else if (arg === "--help" || arg === "-h") {
      printHelp();
      process.exit(0);
    } else {
      throw new Error(`Unknown option: ${arg}`);
    }
  }

  if (options.reportOnly) options.apply = false;
  return options;
}

function readCliPositiveInteger(value: string | undefined, label: string) {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0) throw new Error(`--${label} must be a positive integer`);
  return parsed;
}

function readCliNonNegativeInteger(value: string | undefined, label: string) {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 0) throw new Error(`--${label} must be a non-negative integer`);
  return parsed;
}

function printHelp() {
  console.log(`
Usage: npm run resolve:robloxgo-postgres -- [options]

Resolves RobloxGo place IDs stored in Northflank Postgres to universe IDs,
then compares distinct resolved universes against production Supabase.
This script never inserts into production Supabase.

Options:
  --apply                 Resolve and update Northflank staging rows.
  --report-only           Only print current staging/prod comparison counts.
  --limit <n>             Max unresolved place rows to process; 0 means all.
  --concurrency <n>       Concurrent Roblox place-to-universe requests.
  --select-batch <n>      Rows selected from Postgres per resolver loop.
  --no-compare-prod       Skip production Supabase anti-join report.
  -h, --help              Show this help.
`);
}

function createPool() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) throw new Error("DATABASE_URL is required.");
  const wantsSsl = /sslmode=require/i.test(connectionString) || process.env.PGSSLMODE === "require";
  return new Pool({
    connectionString,
    max: 5,
    ssl: wantsSsl ? { rejectUnauthorized: false } : undefined
  });
}

function supabase() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE;
  if (!url || !key) throw new Error("SUPABASE_URL and SUPABASE_SERVICE_ROLE are required for prod comparison.");
  return createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false }
  });
}

let pool: Pool | null = null;

function getPool() {
  pool ??= createPool();
  return pool;
}

function retryAfterMs(headers: Headers) {
  const value = headers.get("retry-after");
  if (!value) return null;
  const seconds = Number(value);
  if (Number.isFinite(seconds)) return Math.max(seconds * 1000, 0);
  const dateMs = Date.parse(value);
  return Number.isNaN(dateMs) ? null : Math.max(dateMs - Date.now(), 0);
}

function jitter(ms: number) {
  return Math.round(ms * (0.75 + Math.random() * 0.5));
}

async function resolvePlace(placeId: number): Promise<ResolveResult> {
  for (let attempt = 0; attempt <= DEFAULT_RETRY_LIMIT; attempt += 1) {
    let res: Response;
    try {
      res = await fetch(PLACE_TO_UNIVERSE_API(placeId), {
        headers: {
          "user-agent": "BloxodesRobloxGoResolver/1.0",
          accept: "application/json"
        }
      });
    } catch (error) {
      if (attempt >= DEFAULT_RETRY_LIMIT) {
        return {
          place_id: placeId,
          universe_id: null,
          status: "failed",
          last_error: error instanceof Error ? error.message.slice(0, 240) : "request_failed"
        };
      }
      await sleep(jitter(Math.min(DEFAULT_RETRY_BASE_MS * 2 ** attempt, DEFAULT_RETRY_MAX_MS)));
      continue;
    }

    if (res.ok) {
      const payload = (await res.json().catch(() => null)) as { universeId?: number | null } | null;
      const universeId =
        typeof payload?.universeId === "number" && Number.isSafeInteger(payload.universeId) ? payload.universeId : null;
      return {
        place_id: placeId,
        universe_id: universeId,
        status: universeId == null ? "failed" : "resolved",
        last_error: universeId == null ? "no_universe_id" : null
      };
    }

    const retryable = res.status === 429 || res.status >= 500;
    const body = await res.text().catch(() => "");
    if (!retryable || attempt >= DEFAULT_RETRY_LIMIT) {
      return {
        place_id: placeId,
        universe_id: null,
        status: "failed",
        last_error: `http_${res.status}:${body.slice(0, 180)}`
      };
    }

    const delayMs =
      retryAfterMs(res.headers) ?? jitter(Math.min(DEFAULT_RETRY_BASE_MS * 2 ** attempt, DEFAULT_RETRY_MAX_MS));
    await sleep(delayMs);
  }

  return { place_id: placeId, universe_id: null, status: "failed", last_error: "retry_exhausted" };
}

async function mapWithConcurrency<T, R>(items: T[], concurrency: number, mapper: (item: T) => Promise<R>) {
  const results: R[] = new Array(items.length);
  let nextIndex = 0;
  const workers = Array.from({ length: Math.min(concurrency, items.length) }, async () => {
    while (nextIndex < items.length) {
      const index = nextIndex;
      nextIndex += 1;
      results[index] = await mapper(items[index]);
    }
  });
  await Promise.all(workers);
  return results;
}

async function fetchNextPlaceIds(limit: number) {
  const result = await getPool().query<{ place_id: string }>(
    `select place_id::text
     from public.robloxgo_place_discovery
     where universe_id is null
       and status in ('pending', 'failed')
       and resolve_attempts < $2
     order by place_id
     limit $1`,
    [limit, DEFAULT_RETRY_LIMIT + 1]
  );
  return result.rows.map((row) => Number(row.place_id));
}

async function writeResolveResults(results: ResolveResult[]) {
  if (!results.length) return;
  await getPool().query(
    `with incoming as (
       select *
       from jsonb_to_recordset($1::jsonb) as x(
         place_id bigint,
         universe_id bigint,
         status text,
         last_error text
       )
     )
     update public.robloxgo_place_discovery d
     set
       universe_id = coalesce(incoming.universe_id, d.universe_id),
       status = incoming.status,
       last_error = incoming.last_error,
       resolve_attempts = d.resolve_attempts + 1,
       resolved_at = case when incoming.universe_id is not null then now() else d.resolved_at end,
       updated_at = now()
     from incoming
     where d.place_id = incoming.place_id`,
    [JSON.stringify(results)]
  );
}

async function stagingCounts(): Promise<StagingCounts> {
  const result = await getPool().query<StagingCounts>(
    `select
       count(*)::integer as place_rows_total,
       count(*) filter (where universe_id is not null)::integer as resolved_place_rows,
       count(distinct universe_id) filter (where universe_id is not null)::integer as unique_resolved_universes,
       count(*) filter (where status = 'failed' and universe_id is null)::integer as failed_place_rows,
       count(*) filter (where universe_id is null and status in ('pending', 'failed') and resolve_attempts < $1)::integer as pending_place_rows
     from public.robloxgo_place_discovery`,
    [DEFAULT_RETRY_LIMIT + 1]
  );
  return (
    result.rows[0] ?? {
      place_rows_total: 0,
      resolved_place_rows: 0,
      unique_resolved_universes: 0,
      failed_place_rows: 0,
      pending_place_rows: 0
    }
  );
}

async function resolvePlaces(options: Options) {
  if (!options.apply) return;
  let processed = 0;
  let resolved = 0;
  let failed = 0;
  const startedAt = Date.now();

  while (options.limit === 0 || processed < options.limit) {
    const remaining = options.limit === 0 ? options.selectBatch : Math.min(options.selectBatch, options.limit - processed);
    const placeIds = await fetchNextPlaceIds(remaining);
    if (!placeIds.length) break;

    const results = await mapWithConcurrency(placeIds, options.concurrency, resolvePlace);
    await writeResolveResults(results);

    processed += results.length;
    resolved += results.filter((result) => result.universe_id != null).length;
    failed += results.filter((result) => result.universe_id == null).length;

    if (processed % DEFAULT_PROGRESS_EVERY === 0 || results.length < remaining) {
      const elapsedSeconds = Math.max(1, Math.round((Date.now() - startedAt) / 1000));
      console.log(
        `Resolved loop progress: processed=${processed}, resolved=${resolved}, failed=${failed}, rate=${Math.round(
          processed / elapsedSeconds
        )}/s`
      );
    }
  }

  console.log(`Resolve run complete: processed=${processed}, resolved=${resolved}, failed=${failed}.`);
}

async function compareWithProd(uniqueResolvedUniverses: number) {
  if (!uniqueResolvedUniverses) {
    return { prodExistingUniverses: 0, newUniverseCandidates: 0 };
  }

  const sb = supabase();
  let lastUniverseId = 0;
  let checked = 0;
  let prodExistingUniverses = 0;

  while (true) {
    const result = await getPool().query<{ universe_id: string }>(
      `select distinct universe_id::text
       from public.robloxgo_place_discovery
       where universe_id is not null and universe_id > $1
       order by universe_id
       limit $2`,
      [lastUniverseId, PROD_COMPARE_CHUNK_SIZE]
    );
    const ids = result.rows.map((row) => Number(row.universe_id));
    if (!ids.length) break;
    lastUniverseId = ids[ids.length - 1];
    checked += ids.length;

    const { data, error } = await sb.from("roblox_universes").select("universe_id").in("universe_id", ids);
    if (error) throw new Error(`Prod comparison failed: ${error.message}`);
    prodExistingUniverses += (data ?? []).length;

    if (checked % 50000 === 0) {
      console.log(`Prod comparison progress: checked=${checked}/${uniqueResolvedUniverses}`);
    }
  }

  return {
    prodExistingUniverses,
    newUniverseCandidates: uniqueResolvedUniverses - prodExistingUniverses
  };
}

async function main() {
  const options = parseArgs();
  console.log(
    `RobloxGo place resolver (${options.apply ? "apply" : "report-only"}, limit=${options.limit || "all"}, concurrency=${
      options.concurrency
    })`
  );

  if (!options.reportOnly) {
    await resolvePlaces(options);
  }

  const counts = await stagingCounts();
  const duplicatePlaceRows = Math.max(0, counts.resolved_place_rows - counts.unique_resolved_universes);
  console.log("Staging counts");
  console.log(`  place rows total: ${counts.place_rows_total}`);
  console.log(`  resolved place rows: ${counts.resolved_place_rows}`);
  console.log(`  unique resolved universes: ${counts.unique_resolved_universes}`);
  console.log(`  duplicate resolved place rows removed by distinct universe_id: ${duplicatePlaceRows}`);
  console.log(`  unresolved/failed place rows: ${counts.failed_place_rows}`);
  console.log(`  pending resolvable place rows: ${counts.pending_place_rows}`);

  if (options.compareProd) {
    const prod = await compareWithProd(counts.unique_resolved_universes);
    console.log("Prod anti-join");
    console.log(`  already in prod: ${prod.prodExistingUniverses}`);
    console.log(`  new universe candidates: ${prod.newUniverseCandidates}`);
  }
}

main()
  .catch((error) => {
    console.error("RobloxGo place resolution failed:", error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await pool?.end().catch(() => undefined);
  });
