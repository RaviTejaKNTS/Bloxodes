import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import test from "node:test";
import { migrationBody } from "../../ci/migration-transaction.mjs";

const read = (path: string) => readFileSync(new URL(`../../../${path}`, import.meta.url), "utf8");
const migration = (name: string) => read(`supabase/migrations/${name}.sql`);

// Like the other SQL fixtures, load whole production statements, never rewritten
// trigger bodies. The real snapshot supplies column constraints; the relevant
// forward migration chain supplies the route mapper, view and actual row triggers.
// Unrelated search, cache workers and content seed migrations are outside this fixture.
function sqlFunction(sql: string, name: string): string {
  const match = sql.match(new RegExp(`create (?:or replace )?function public\\.${name}\\([\\s\\S]*?\\bas (\\$[a-zA-Z_0-9]*\\$)[\\s\\S]*?\\1;`, "i"));
  assert.ok(match, `Production function ${name}`);
  return match[0];
}

test("IndexNow first publication: real route/publication chain, seed, drain, expiry and failure isolation", {
  skip: process.env.CI !== "true"
}, () => {
  const databaseUrl = process.env.CI_TRANSACTION_DATABASE_URL;
  assert.ok(databaseUrl, "CI_TRANSACTION_DATABASE_URL required in CI; never silently skip");
  const url = new URL(databaseUrl);
  assert.ok(["localhost", "127.0.0.1"].includes(url.hostname) && url.search === "");
  const env = Object.fromEntries(Object.entries(process.env).filter(([key]) => !key.startsWith("PG")));
  const snapshot = read("supabase/schema.sql");
  const tables = ["games", "code_pages", "wiki_pages", "wiki_collection_pages", "quiz_pages", "checklist_pages", "tools", "events_pages", "articles", "catalog_pages", "puzzle_pages", "authors",
    ...["wiki", "collection", "code", "tool", "checklist", "map", "quiz", "catalog"].map(kind => `game_${kind}_pages`)];
  const definitions = tables.map(name => {
    const definition = snapshot.match(new RegExp(`CREATE TABLE public\\.${name} \\([\\s\\S]*?\\n\\);`));
    assert.ok(definition, `Real column contract for ${name}`);
    // UUID extension defaults are the only platform substitution.
    return definition[0].replaceAll("extensions.uuid_generate_v4()", "gen_random_uuid()");
  });
  const keys = [...snapshot.matchAll(/ALTER TABLE ONLY public\.(\w+)\s+ADD CONSTRAINT [^;]+;/g)]
    .filter(match => tables.includes(match[1]) && / PRIMARY KEY | UNIQUE /.test(match[0])).map(match => match[0]);
  const registry = migration("20261031194915_site_routes_registry");
  const urlStyle = migration("20261101120000_game_page_type_urls");
  const specialized = migration("20261102130000_specialized_franchise_page_type_urls");
  const article = migration("20261104120000_game_article_pages");
  const articleTable = article.match(/create table public\.game_article_pages \([\s\S]*?\n\);/i);
  assert.ok(articleTable);
  const chain: string[] = [
    // Complete registry migration, including its route backfill and triggers.
    migrationBody(registry),
    ...urlStyle.match(/alter table public\.games (?:add column url_style|alter column url_style)[^;]+;/g)!,
    sqlFunction(urlStyle, "expected_game_page_path"),
    sqlFunction(urlStyle, "site_page_route"),
    sqlFunction(specialized, "is_archived_minecraft_game"),
    sqlFunction(specialized, "expected_game_page_path"),
    sqlFunction(specialized, "site_page_route"),
    migrationBody(migration("20261102150000_prepare_game_content_check_after_inherit")),
    sqlFunction(urlStyle, "prepare_game_extended_page"),
    articleTable[0],
    sqlFunction(article, "expected_game_page_path")
  ];
  const currentView = article.match(/create or replace view public\.expected_site_routes[\s\S]*?;/i);
  assert.ok(currentView);
  chain.push(currentView[0]);
  // Use the snapshot's actual BEFORE publication guards for representative rows.
  const publishFunctions = ["set_article_published_at", "set_wiki_page_published_at", "set_catalog_page_published_at"];
  const publicationTriggers = [...snapshot.matchAll(/CREATE TRIGGER [^;]+;/g)]
    .filter(match => /ON public\.(articles|wiki_pages|wiki_collection_pages|games|game_wiki_pages)\b/.test(match[0]) &&
      /EXECUTE FUNCTION public\.(set_article_published_at|set_wiki_page_published_at|set_catalog_page_published_at|prepare_game_content)\(/.test(match[0])).map(match => match[0]);
  const fixture = read("supabase/tests/indexnow-first-publication.sql");
  assert.match(fixture, /^\\set ON_ERROR_STOP on\s+begin;/);
  assert.match(fixture, /rollback;\s*$/);
  assert.equal(fixture.split("-- APPLY INDEXNOW MIGRATION HERE").length, 2);
  const transactionalFixture = fixture.replace(/\bbegin;/, "savepoint fixture;").replace(/rollback;\s*$/, "rollback to savepoint fixture;")
    .replace("-- APPLY INDEXNOW MIGRATION HERE", migrationBody(migration("20261116170832_indexnow_first_publication")));
  execFileSync("psql", [databaseUrl, "-X", "-q", "-v", "ON_ERROR_STOP=1"], {
    input: `begin;
      do $$ begin
        begin create role anon; exception when duplicate_object or unique_violation then null; end;
        begin create role authenticated; exception when duplicate_object or unique_violation then null; end;
        begin create role service_role; exception when duplicate_object or unique_violation then null; end;
      end $$;
      create schema if not exists extensions;
      create extension if not exists pgcrypto with schema extensions;
      ${["safe_game_content_url", "valid_game_codes_faq", "valid_game_page_data", "valid_gta_map_snapshot"].map(name => sqlFunction(snapshot, name)).join("\n")}
      ${definitions.join("\n")}
      ${keys.join("\n")}
      ${chain.join("\n")}
      ${publishFunctions.map(name => sqlFunction(snapshot, name)).join("\n")}
      ${publicationTriggers.join("\n")}
      ${migrationBody(migration("20261109125824_stats_reports"))}
      ${transactionalFixture}
      rollback;`,
    encoding: "utf8", stdio: ["pipe", "pipe", "pipe"], timeout: 30_000, env
  });
});
