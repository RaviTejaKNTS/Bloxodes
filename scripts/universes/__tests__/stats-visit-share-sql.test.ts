import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import test from "node:test";

import { VisitShareSummaryBuilder, type VisitShareSourceGame } from "../stats-visit-share-summary";

// Uses the existing GitHub PostgreSQL 17 service, never a workstation or a
// managed/production database. Everything, including role setup, rolls back.
test("prepared visit-share rows equal the original SQL RPC for all ten windows", {
  skip: process.env.CI !== "true" || !process.env.CI_TRANSACTION_DATABASE_URL
}, () => {
  const databaseUrl = process.env.CI_TRANSACTION_DATABASE_URL!;
  assert.ok(["localhost", "127.0.0.1"].includes(new URL(databaseUrl).hostname));
  const original = readFileSync(new URL("../../../supabase/migrations/20260918000008_stats_visit_share_chart.sql", import.meta.url), "utf8");
  const migration = readFileSync(new URL("../../../supabase/migrations/20261025090000_stats_visit_share_summaries.sql", import.meta.url), "utf8");
  const games: VisitShareSourceGame[] = Array.from({ length: 1105 }, (_, index) => ({
    universe_id: String(index + 1),
    visits: {
      "2026-07-27": String(1106 - index),
      "2026-09-25": String((index % 11) + 1),
      "2026-10-11": String((index % 7) + 1),
      "2026-10-18": String((index % 5) + 1),
      "2026-10-19": String((index % 3) + 1),
      "2026-10-24": String((index % 13) + 1),
      "2026-10-25": String((index % 17) + 1)
    }
  }));
  // The source SQL must prefer a stored delta (even negative/zero) over
  // end-start, use end-start only for NULL, and clamp negative values to zero.
  // These extra raw rows do not share dates with the generated positive rows.
  games[0].visits["2026-10-20"] = "9007199254740993";
  games[1].visits["2026-10-21"] = "10";
  const builder = new VisitShareSummaryBuilder("2026-10-25");
  for (let offset = 0; offset < games.length; offset += 123) builder.addBatch(games.slice(offset, offset + 123));
  const windows = builder.build();
  const sqlJson = (value: unknown) => `'${JSON.stringify(value).replaceAll("'", "''")}'::jsonb`;
  const sql = `
    begin;
    do $$ begin
      if not exists (select 1 from pg_roles where rolname = 'anon') then create role anon; end if;
      if not exists (select 1 from pg_roles where rolname = 'authenticated') then create role authenticated; end if;
      if not exists (select 1 from pg_roles where rolname = 'service_role') then create role service_role; end if;
    end $$;
    create table public.roblox_universes (
      universe_id bigint primary key, name text, display_name text, slug text, icon_url text
    );
    create table public.roblox_universe_stats_daily (
      universe_id bigint references public.roblox_universes on delete cascade,
      stat_date date, visit_delta bigint, visits_start bigint, visits_end bigint,
      primary key (universe_id, stat_date)
    );
    ${original}
    ${migration}
    insert into public.roblox_universes
      select value, 'Name ' || value, case when value % 2 = 0 then '' else 'Display ' || value end,
        'game-' || value, 'https://example.com/' || value || '.png'
      from generate_series(1, 1106) value;
    create temporary table fixture_games as
      select * from jsonb_to_recordset(${sqlJson(games)}) as g(universe_id bigint, visits jsonb);
    insert into public.roblox_universe_stats_daily
      select g.universe_id, d.key::date, d.value::bigint, null, null
      from fixture_games g cross join lateral jsonb_each_text(g.visits) d;
    update public.roblox_universe_stats_daily
      set visit_delta = null, visits_start = 1, visits_end = 9007199254740994
      where universe_id = 1 and stat_date = '2026-10-20';
    insert into public.roblox_universe_stats_daily values
      (1, '2026-10-21', -5, 0, 999),
      (1, '2026-10-22', 0, 0, 999),
      (1, '2026-10-23', null, 10, 1),
      (2, '2026-10-20', null, null, 100),
      (1106, '2026-10-20', null, null, null);

    -- Verify bounded parent-key paging returns every normalized source row,
    -- including games missing from any current index, without JSON truncation.
    create temporary table copied_source (universe_id bigint, stat_date date, visits bigint);
    do $$ declare
      page jsonb; cursor_id bigint := 0; previous_id bigint; page_games integer;
    begin
      loop
        previous_id := cursor_id;
        page := public.get_stats_visit_share_source_batch('2026-07-27', '2026-10-26', cursor_id, 5000);
        page_games := jsonb_array_length(page->'games');
        if page_games > 500 then raise exception 'source batch cap failed'; end if;
        if page_games = 0 then exit; end if;
        cursor_id := (page->>'next_after')::bigint;
        if cursor_id <= previous_id then raise exception 'source cursor failed'; end if;
        insert into copied_source
          select g.universe_id, d.key::date, d.value::bigint
          from jsonb_to_recordset(page->'games') as g(universe_id bigint, visits jsonb)
          cross join lateral jsonb_each_text(g.visits) d;
      end loop;
      if exists (
        (select * from copied_source except all
          select universe_id, stat_date, greatest(coalesce(visit_delta, visits_end - visits_start, 0), 0)
          from public.roblox_universe_stats_daily
          where greatest(coalesce(visit_delta, visits_end - visits_start, 0), 0) > 0)
        union all
        (select universe_id, stat_date, greatest(coalesce(visit_delta, visits_end - visits_start, 0), 0)
          from public.roblox_universe_stats_daily
          where greatest(coalesce(visit_delta, visits_end - visits_start, 0), 0) > 0
          except all select * from copied_source)
      ) then raise exception 'source rows differ'; end if;
    end $$;

    select public.replace_stats_visit_share_summaries('2026-10-25', ${sqlJson(windows)}, '2026-10-25T01:05:00Z');
    do $$ declare w record; begin
      for w in select since_date, until_date from public.stats_visit_share_summaries loop
        if exists (
          (select * from public.get_stats_visit_share_chart(w.since_date, w.until_date)
            except all select * from public.get_stats_visit_share_chart_live(w.since_date, w.until_date))
          union all
          (select * from public.get_stats_visit_share_chart_live(w.since_date, w.until_date)
            except all select * from public.get_stats_visit_share_chart(w.since_date, w.until_date))
        ) then raise exception 'prepared rows differ for % to %', w.since_date, w.until_date; end if;
      end loop;
      if exists (
        (select * from public.get_stats_visit_share_chart('2026-10-18', '2026-10-25', 2, 10, 20)
          except all select * from public.get_stats_visit_share_chart_live('2026-10-18', '2026-10-25', 2, 10, 20))
        union all
        (select * from public.get_stats_visit_share_chart_live('2026-10-18', '2026-10-25', 2, 10, 20)
          except all select * from public.get_stats_visit_share_chart('2026-10-18', '2026-10-25', 2, 10, 20))
      ) then raise exception 'custom bucket fallback differs'; end if;
    end $$;

    -- Names/icons stay current without rebuilding the prepared visit totals.
    update public.roblox_universes set display_name = 'Renamed', slug = 'renamed', icon_url = 'new.png' where universe_id = 1;
    do $$ begin
      if not exists (select 1 from public.get_stats_visit_share_chart('2026-10-18', '2026-10-25')
        where universe_id = 1 and bucket_name = 'Renamed' and slug = 'renamed' and icon_url = 'new.png')
      then raise exception 'live metadata was lost'; end if;
    end $$;

    do $$ begin
      if public.replace_stats_visit_share_summaries('2026-10-25', ${sqlJson(windows)}, '2026-10-24T01:05:00Z') <> 0
      then raise exception 'stale publisher was accepted'; end if;
      begin
        perform public.replace_stats_visit_share_summaries('2026-10-25', '[]'::jsonb, now());
        raise exception using errcode = 'XX000', message = 'incomplete publisher was accepted';
      exception when raise_exception then null;
      end;
      if (select count(*) from public.stats_visit_share_summaries) <> 10
      then raise exception 'failed publish damaged existing results'; end if;
      if has_function_privilege('anon', 'public.get_stats_visit_share_chart(date,date,integer,integer,integer)', 'execute')
        or has_function_privilege('authenticated', 'public.get_stats_visit_share_source_batch(date,date,bigint,integer)', 'execute')
        or has_function_privilege('anon', 'public.replace_stats_visit_share_summaries(date,jsonb,timestamptz)', 'execute')
        or has_table_privilege('anon', 'public.stats_visit_share_summaries', 'select')
      then raise exception 'private stats data was exposed'; end if;
      if not (select relrowsecurity from pg_class where oid = 'public.stats_visit_share_summaries'::regclass)
      then raise exception 'summary RLS is disabled'; end if;
    end $$;

    delete from public.stats_visit_share_summaries;
    do $$ declare anchor date := (now() at time zone 'UTC')::date; begin
      begin
        perform public.get_stats_visit_share_chart(anchor - 90, anchor);
        raise exception using errcode = 'XX000', message = 'missing summary silently scanned history';
      exception when sqlstate '55000' then null;
      end;
    end $$;
    rollback;
  `;
  execFileSync("psql", [databaseUrl, "-X", "-q", "-v", "ON_ERROR_STOP=1"], {
    input: sql, encoding: "utf8", stdio: ["pipe", "pipe", "pipe"], timeout: 60_000
  });
});
