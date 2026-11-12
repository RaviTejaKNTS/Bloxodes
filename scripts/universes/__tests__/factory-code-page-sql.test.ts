import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import test from "node:test";
import { commitFactoryPage, factoryPublicationPayload } from "../../codes/factory-commit";

// Loaded by test:universe-stats-pipeline in pull-request.yml, PostgreSQL 17 only.
test("factory code-page RPC accepts production payloads and commits atomically", {
  skip: process.env.CI !== "true" || !process.env.CI_TRANSACTION_DATABASE_URL
}, async () => {
  const databaseUrl = process.env.CI_TRANSACTION_DATABASE_URL!;
  const url = new URL(databaseUrl);
  assert.ok(["localhost", "127.0.0.1"].includes(url.hostname) && url.search === "");
  const env = Object.fromEntries(Object.entries(process.env).filter(([key]) => !key.startsWith("PG")));
  const schema = readFileSync(new URL("../../../supabase/schema.sql", import.meta.url), "utf8");
  const table = schema.match(/CREATE TABLE public\.code_pages \([\s\S]*?\n\);/)?.[0];
  assert.ok(table, "Use the real code_pages column contract");
  const migration = readFileSync(new URL("../../../supabase/migrations/20261106065542_publish_factory_code_page.sql", import.meta.url), "utf8");
  const fixture = readFileSync(new URL("../../../supabase/tests/factory_code_page_publication.sql", import.meta.url), "utf8");
  let payload: unknown;
  await commitFactoryPage({ rpc: async (_name: string, args: any) => { payload = args.p_payload; return {}; } } as any,
    "00000000-0000-0000-0000-000000000001", factoryPublicationPayload({
      name: "Example", slug: "example", universe_id: 1, roblox_link: "https://www.roblox.com/games/2",
      source_url: "https://robloxden.com/game-codes/example", source_url_2: null,
      social_links: { discord: null, twitter: null, youtube: null },
      intro_md: "Intro", redeem_md: "Redeem", troubleshoot_md: "Trouble", rewards_md: "Rewards",
      find_codes_md: "Find", meta_description: "x".repeat(155), interlinking_copy_md: "[Other](/codes/other)"
    }), { universeId: 1, fingerprint: "a".repeat(64), linkedIds: [] }, 1, true, async () => "new-cover");
  const sqlPayload = JSON.stringify(payload).replaceAll("'", "''");
  execFileSync("psql", [databaseUrl, "-X", "-q", "-v", "ON_ERROR_STOP=1"], {
    input: `begin;
      do $$ begin
        if not exists (select 1 from pg_roles where rolname = 'anon') then create role anon; end if;
        if not exists (select 1 from pg_roles where rolname = 'authenticated') then create role authenticated; end if;
        if not exists (select 1 from pg_roles where rolname = 'service_role') then create role service_role; end if;
      end $$;
      ${table.replace("extensions.uuid_generate_v4()", "gen_random_uuid()")}
      grant select, update on public.code_pages to service_role;
      ${migration}
      create temp table factory_test_payload (payload jsonb);
      insert into factory_test_payload values ('${sqlPayload}'::jsonb);
      grant select on factory_test_payload to service_role;
      ${fixture}
      rollback;`,
    encoding: "utf8", stdio: ["pipe", "pipe", "pipe"], timeout: 30_000, env
  });
});
