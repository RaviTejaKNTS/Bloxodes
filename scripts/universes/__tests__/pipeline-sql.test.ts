import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import test from "node:test";

const skip = process.env.CI !== "true" || !process.env.CI_TRANSACTION_DATABASE_URL;

function migration(name: string): string {
  return readFileSync(new URL(`../../../supabase/migrations/${name}.sql`, import.meta.url), "utf8");
}

// Select whole SQL sections by unique statement boundaries, never copy function
// bodies into this harness. Unrelated Supabase APIs/triggers need no CI stubs.
function section(sql: string, start: string, end?: string): string {
  const offset = sql.indexOf(start);
  assert.ok(offset >= 0 && sql.indexOf(start, offset + start.length) === -1, `Unique SQL start: ${start}`);
  if (!end) return sql.slice(offset);
  const finish = sql.indexOf(end, offset + start.length);
  assert.ok(finish > offset, `SQL end: ${end}`);
  return sql.slice(offset, finish);
}

const universeSchema = `
  create table public.roblox_universes (
    universe_id bigint primary key, root_place_id bigint, name text, slug text,
    playing bigint, visits bigint, favorites bigint, likes bigint, dislikes bigint,
    created_at_api timestamptz, updated_at_api timestamptz, stats_tier text,
    stats_tier_reason text, last_stats_refreshed_at timestamptz,
    last_seen_in_search timestamptz, last_seen_in_sort timestamptz,
    next_stats_refresh_at timestamptz, stats_refresh_locked_at timestamptz,
    stats_refresh_locked_by text, stats_refresh_attempt_count integer default 0,
    last_stats_refresh_error text, last_playing_refreshed_at timestamptz,
    created_at timestamptz default now()
  );
`;

function runFixture(name: string, schema: string): void {
  const databaseUrl = process.env.CI_TRANSACTION_DATABASE_URL!;
  // A query string (hostaddr=, host=) or PG* env vars could reroute psql away
  // from the checked host, so allow neither.
  const url = new URL(databaseUrl);
  assert.ok(["localhost", "127.0.0.1"].includes(url.hostname) && url.search === "");
  const env = Object.fromEntries(Object.entries(process.env).filter(([key]) => !key.startsWith("PG")));
  const fixture = readFileSync(new URL(`../../../supabase/tests/${name}.sql`, import.meta.url), "utf8");
  // These standalone psql fixtures own BEGIN/ROLLBACK. Use a savepoint so their
  // rollback cannot leave the harness's schema/roles committed in the service.
  // Keep \set ON_ERROR_STOP intact: psql handles it, with -v as a second guard.
  assert.match(fixture, /^\\set ON_ERROR_STOP on\s+(?:--[^\n]*\n\s*)?begin;/);
  assert.match(fixture, /rollback;\s*$/);
  const transactionalFixture = fixture
    .replace(/\bbegin;/, "savepoint fixture;")
    .replace(/rollback;\s*$/, "rollback to savepoint fixture;");
  execFileSync("psql", [databaseUrl, "-X", "-v", "ON_ERROR_STOP=1", "-q"], {
    input: `
      begin;
      do $$ begin
        if not exists (select 1 from pg_roles where rolname = 'anon') then create role anon; end if;
        if not exists (select 1 from pg_roles where rolname = 'authenticated') then create role authenticated; end if;
        if not exists (select 1 from pg_roles where rolname = 'service_role') then create role service_role; end if;
      end $$;
      ${schema}
      ${transactionalFixture}
      rollback;
    `,
    encoding: "utf8", stdio: ["pipe", "pipe", "pipe"], timeout: 30_000, env
  });
}

// Picked up by test:universe-stats-pipeline's existing *.test.ts glob in PR CI.
// Only GitHub's isolated PostgreSQL 17 service; no env loader or managed writes.
test("item SQL pipeline: identities, null-safe upserts, worker claims and daily index deltas", { skip }, () => {
  const catalog = migration("20260726_create_roblox_catalog_items");
  const stats = migration("20260918000005_stats_items_pipeline");
  const hardening = migration("20260919000001_harden_roblox_item_pipeline");
  runFixture("roblox_item_pipeline", [
    section(migration("20260411_create_tools_table"), "create or replace function public.set_updated_at()", "create table if not exists public.tools"),
    section(catalog, "create table if not exists public.roblox_catalog_items (", "create table if not exists public.roblox_catalog_categories ("),
    section(catalog, "create table if not exists public.roblox_catalog_refresh_queue ("),
    section(migration("20260911000001_fix_avatar_catalog_pipeline"), "alter table public.roblox_catalog_items", "create index if not exists"),
    "create schema if not exists extensions;",
    // Tables, indexes and the two URL/delta helpers, before the obsolete rebuild.
    section(stats, "alter table public.roblox_catalog_items\n  add column if not exists item_stats_tier", "create or replace function public.refresh_stats_item_current_indexes()"),
    // Queue functions, identity trigger and release; omit unrelated health RPC.
    section(hardening, "alter table public.roblox_catalog_items\n  add column if not exists roblox_item_id", "create or replace function public.get_roblox_item_pipeline_health()"),
    section(hardening, "create or replace function public.refresh_stats_item_current_indexes()", "revoke all on function public.enqueue_roblox_catalog_refresh"),
    section(migration("20260919000002_quarantine_unavailable_roblox_items"), "create or replace function public.claim_roblox_item_stats_rows(", "create or replace function public.get_roblox_item_pipeline_health()"),
    // Include the live uniqueness constraint: the legacy-bundle assertion must
    // exercise the same conflict that prompted the October 24 trigger fix.
    section(migration("20261002111156_retire_duplicate_legacy_bundle_rows"), "create unique index if not exists idx_roblox_catalog_live_canonical_key", "create or replace function public.get_roblox_item_pipeline_health()"),
    migration("20261024015000_keep_live_legacy_bundle_upserts_on_their_row")
  ].join("\n"));
});

test("universe SQL claims: 500-row narrow contract, disjoint workers and lease ownership", { skip }, () => {
  runFixture("universe_stats_claim_pipeline", [
    universeSchema,
    // The release RPC has not changed since September 19. The claim RPC has.
    section(migration("20260919000004_harden_universe_stats_claims"), "create or replace function public.release_roblox_universe_stats_rows(", "revoke all on function public.claim_roblox_universe_stats_rows"),
    // Lease table, claim/release functions and grants, without unrelated rebuild.
    section(migration("20260920000001_repair_universe_stats_claim_pipeline"), "create table if not exists public.stats_pipeline_leases", "create or replace function public.refresh_stats_current_indexes_serialized()"),
    migration("20261030073408_warm_universe_stats_claim_grace")
  ].join("\n"));
});

test("universe SQL health: WARM seven-hour grace and unchanged NEW/COLD windows", { skip }, () => {
  runFixture("universe_pipeline_health", `
    ${universeSchema}
    create table public.stats_game_current_index (
      playing bigint, last_playing_refreshed_at timestamptz, indexed_at timestamptz
    );
    create table public.stats_job_runs (
      job_name text, started_at timestamptz, finished_at timestamptz,
      status text, rows_succeeded integer default 0, rows_failed integer default 0
    );
    create table public.roblox_universe_stats_hourly (hour_start timestamptz);
    create table public.roblox_universe_rank_snapshots_hourly (hour_start timestamptz);
    ${migration("20261030054510_widen_warm_refresh_health_window")}
  `);
});
