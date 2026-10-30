import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import test from "node:test";

// GitHub's isolated PostgreSQL service only. No managed or production writes.
test("WARM claim grace preserves cadence, backoff, leases and other tiers", {
  skip: process.env.CI !== "true" || !process.env.CI_TRANSACTION_DATABASE_URL
}, () => {
  const databaseUrl = process.env.CI_TRANSACTION_DATABASE_URL!;
  assert.ok(["localhost", "127.0.0.1"].includes(new URL(databaseUrl).hostname));
  const migration = readFileSync(new URL(
    "../../../supabase/migrations/20261030073408_warm_universe_stats_claim_grace.sql", import.meta.url
  ), "utf8");
  const fixtures = readFileSync(new URL("../../../supabase/tests/warm_universe_stats_claim_grace.sql", import.meta.url), "utf8");
  const sql = `
    begin;
    do $$ begin
      if not exists (select 1 from pg_roles where rolname = 'anon') then create role anon; end if;
      if not exists (select 1 from pg_roles where rolname = 'authenticated') then create role authenticated; end if;
      if not exists (select 1 from pg_roles where rolname = 'service_role') then create role service_role; end if;
    end $$;
    create table public.roblox_universes (
      universe_id bigint primary key, root_place_id bigint, slug text,
      playing bigint, visits bigint, favorites bigint, likes bigint, dislikes bigint,
      created_at_api timestamptz, updated_at_api timestamptz, stats_tier text,
      stats_tier_reason text, last_stats_refreshed_at timestamptz,
      last_seen_in_search timestamptz, last_seen_in_sort timestamptz,
      next_stats_refresh_at timestamptz, stats_refresh_locked_at timestamptz,
      stats_refresh_locked_by text, stats_refresh_attempt_count integer default 0,
      last_stats_refresh_error text
    );
    ${migration}
    ${fixtures}
    rollback;
  `;
  execFileSync("psql", [databaseUrl, "-X", "-v", "ON_ERROR_STOP=1", "-q"], {
    input: sql, encoding: "utf8", stdio: ["pipe", "pipe", "pipe"]
  });
});
