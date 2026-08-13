\set ON_ERROR_STOP on

do $$
begin
  if not exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'wiki_pages'
      and column_name = 'description_md'
  ) then
    raise exception '20260627215244 object proof failed: wiki_pages.description_md is missing';
  end if;

  if to_regclass('public.wiki_pages_view') is null then
    raise exception '20260628000100 object proof failed: wiki_pages_view is missing';
  end if;

  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'wiki_pages_view'
      and column_name = 'universe_game_description_md'
  ) then
    raise exception '20260628000100 object proof failed: retired view fallback column still exists';
  end if;

  if to_regclass('public.roblox_mesh_ids') is null then
    raise exception '20260805170407 object proof failed: roblox_mesh_ids is missing';
  end if;

  if to_regprocedure('public.get_stats_visit_share_chart(date,date,integer,integer,integer)') is null then
    raise exception '20260918000008 object proof failed: chart RPC is missing';
  end if;

  if to_regclass('public.roblox_font_ids') is null then
    raise exception '20260919000005 object proof failed: roblox_font_ids is missing';
  end if;
end
$$;
