import assert from "node:assert/strict";
import { execFileSync, spawn } from "node:child_process";
import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import test from "node:test";
import { minecraftLegacyRedirect } from "../../../apps/web/src/lib/minecraft-paths";

// Executes the actual migration and row triggers in GitHub's disposable Postgres.
// Never connects to managed development or production. No local execution.
test("site route backfill, selective update locks, hub restoration, ownership and permissions", {
  skip: process.env.CI !== "true" || !process.env.CI_TRANSACTION_DATABASE_URL
}, async () => {
  const url = process.env.CI_TRANSACTION_DATABASE_URL!;
  assert.ok(["localhost", "127.0.0.1"].includes(new URL(url).hostname));
  const migration = readFileSync(new URL("../../../supabase/migrations/20261031194915_site_routes_registry.sql", import.meta.url), "utf8")
    .replace(/^begin;\s*/i, "").replace(/commit;\s*$/i, "");
  const fixture = readFileSync(new URL("../../../supabase/tests/site_routes.sql", import.meta.url), "utf8");
  const tables = ["code_pages", "wiki_pages", "wiki_collection_pages", "quiz_pages", "checklist_pages", "tools", "events_pages", "articles", "catalog_pages", "puzzle_pages",
    ...["wiki", "collection", "code", "tool", "checklist", "map", "quiz", "catalog"].map(kind => `game_${kind}_pages`)];
  // Commit the migration before assertions: its backfill advisory lock must be
  // released before pg_locks can prove that unrelated updates acquire no lock.
  // Isolate committed fixtures from all other CI tests and always remove them.
  const database = `site_routes_${randomUUID().replaceAll("-", "")}`;
  const fixtureUrl = new URL(url);
  fixtureUrl.pathname = `/${database}`;
  const psql = (target: string, input: string) => execFileSync("psql", [target, "-X", "-v", "ON_ERROR_STOP=1", "-q"], {
    input, encoding: "utf8", stdio: ["pipe", "pipe", "pipe"]
  });
  const sql = `begin;
    do $$ begin
      if not exists(select from pg_roles where rolname='anon') then create role anon; end if;
      if not exists(select from pg_roles where rolname='authenticated') then create role authenticated; end if;
      if not exists(select from pg_roles where rolname='service_role') then create role service_role; end if;
    end $$;
    create table public.games(id uuid primary key default gen_random_uuid(), namespace text, parent_id uuid, is_published boolean default false);
    ${tables.map(table => `create table public.${table}(id uuid primary key default gen_random_uuid(), slug text, code text, wiki_slug text, collection_slug text, canonical_path text, game_id uuid references public.games(id), old_slugs text[] not null default '{}', is_published boolean default false, dataset_revision_id uuid);`).join("\n")}
    insert into public.code_pages(id,slug,old_slugs) values('00000000-0000-0000-0000-000000000001','slap-battles',array['previous-slap','slap-battles']);
    insert into public.articles(slug) values('all-fisch-enchantments-guide');
    insert into public.games(id,namespace) values('00000000-0000-0000-0000-000000000002','fixture-game');
    insert into public.game_wiki_pages(game_id,canonical_path) values('00000000-0000-0000-0000-000000000002','/fixture-game');
    insert into public.game_catalog_pages(game_id,canonical_path) values('00000000-0000-0000-0000-000000000002','/fixture-game');
    insert into public.catalog_pages(id,code,is_published) values
      ('00000000-0000-0000-0000-000000000020','roblox-free-items',true),
      ('00000000-0000-0000-0000-000000000021','free-roblox-items',true),
      ('00000000-0000-0000-0000-000000000022','roblox-music-ids/games/work-at-a-pizza-place',true);
    insert into public.catalog_pages(code) values('the-forge-missing'),('roblox-items-and-bundles/roblox-accessories/hair-accessories');
    ${tables.map(table => `insert into public.${table}(slug,code,wiki_slug,collection_slug,canonical_path,game_id)
      values('initial-${table}','initial-${table}','initial-${table}','initial-${table}','/fixture-game/initial-${table}','00000000-0000-0000-0000-000000000002');`).join("\n")}
    commit;`;
  const lockStep = migration.match(/set local lock_timeout = '3s';\s*lock table [^;]+;/)?.[0];
  assert.ok(lockStep, "exercise the actual migration lock step");
  const lockedTables = [...lockStep.matchAll(/public\.(\w+)/g)].map(match => match[1]);
  assert.equal(lockedTables.length, 19);
  assert.equal(new Set(lockedTables).size, 19);
  assert.deepEqual(lockedTables.slice(0, 8), ["games", "game_wiki_pages", "game_code_pages", "game_tool_pages", "game_map_pages", "game_quiz_pages", "game_catalog_pages", "game_checklist_pages"]);
  assert.ok(lockedTables.indexOf("game_wiki_pages") < lockedTables.indexOf("game_collection_pages"));
  assert.ok(lockedTables.indexOf("wiki_pages") < lockedTables.indexOf("wiki_collection_pages"));
  const connection = () => {
    const child = spawn("psql", [fixtureUrl.toString(), "-X", "-A", "-t", "-v", "ON_ERROR_STOP=1", "-v", "VERBOSITY=verbose"], { stdio: ["pipe", "pipe", "pipe"] });
    let output = "";
    let ready!: () => void;
    const started = new Promise<void>(resolve => { ready = resolve; });
    child.stdout.on("data", chunk => { output += chunk; if (output.includes("publisher-ready")) ready(); });
    child.stderr.on("data", chunk => { output += chunk; });
    const watchdog = setTimeout(() => child.kill("SIGKILL"), 15_000);
    const done = new Promise<{ code: number | null; output: string }>((resolve, reject) => {
      child.on("error", reject);
      child.on("close", code => { clearTimeout(watchdog); ready(); resolve({ code, output }); });
    });
    return { child, started, done };
  };
  const exerciseLock = async (timeout: boolean) => {
    const publisher = connection();
    let locker: ReturnType<typeof connection> | undefined;
    try {
      // Faithful transaction stand-in: the batch RPC writes games before wiki.
      // Run BEFORE installing route triggers, matching a live Phase 1 publisher.
      publisher.child.stdin.write("begin; update public.games set is_published=true; select 'publisher-ready';\n");
      await publisher.started;
      locker = connection();
      locker.child.stdin.end(`begin; ${lockStep} commit;`);
      if (!timeout) {
        // Wait for the migration's actual pending table lock, not a wall-clock
        // guess. A reversed wiki-before-games order creates the original cycle.
        publisher.child.stdin.end(`do $$ declare waiting boolean:=false; begin
          for attempt in 1..200 loop
            select exists(select from pg_locks where relation='public.games'::regclass and mode='ShareRowExclusiveLock' and not granted) into waiting;
            exit when waiting; perform pg_sleep(0.01);
          end loop;
          if not waiting then raise exception 'migration did not wait on games'; end if;
        end $$;
        update public.game_wiki_pages set is_published=true; commit;`);
      }
      const result = await locker.done;
      if (timeout) {
        assert.notEqual(result.code, 0, result.output);
        assert.match(result.output, /55P03/);
        assert.match(result.output, /lock timeout/);
        publisher.child.stdin.end("rollback;");
      } else {
        assert.equal(result.code, 0, result.output);
      }
      const published = await publisher.done;
      assert.equal(published.code, 0, published.output);
    } finally {
      publisher.child.kill();
      locker?.child.kill();
    }
  };
  psql(url, `create database "${database}";`);
  try {
    psql(fixtureUrl.toString(), sql);
    await exerciseLock(false);
    await exerciseLock(true);
    // A failed lock attempt leaves no partial registry objects. Retry the full
    // migration after the publisher ends, then run the SQL ownership assertions.
    psql(fixtureUrl.toString(), `begin; ${migration} commit; begin; ${fixture} rollback;`);
  } finally {
    psql(url, `drop database "${database}" with (force);`);
  }
});

// The registry resolves paths only. Phase 3 must run this request handler first.
test("Minecraft edition query redirects remain authoritative before the registry", () => {
  assert.equal(minecraftLegacyRedirect("/minecraft/wiki", "?edition=bedrock&ref=guide"), "/minecraft/bedrock/wiki?ref=guide");
  assert.equal(minecraftLegacyRedirect("/minecraft/wiki/achievements", "?edition=java"), "/minecraft/java/wiki/achievements");
  assert.equal(minecraftLegacyRedirect("/minecraft/java/wiki/mobs", "?edition=bedrock&ref=guide"), "/minecraft/java/wiki/mobs?ref=guide");
  assert.equal(minecraftLegacyRedirect("/minecraft/tools/test", "?edition=java"), "/minecraft/tools/test");
  assert.equal(minecraftLegacyRedirect("/minecraft/wiki", ""), null);
});
