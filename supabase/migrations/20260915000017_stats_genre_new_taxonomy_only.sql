create or replace function public.get_stats_subgenre_options()
returns table (
  genre text,
  subgenre text,
  games integer,
  playing bigint
)
language sql
stable
set search_path = ''
as $$
  select
    btrim(genre_l1) as genre,
    btrim(genre_l2) as subgenre,
    count(*)::integer as games,
    coalesce(sum(playing), 0)::bigint as playing
  from public.stats_game_current_index
  where genre_l1 is not null
    and btrim(genre_l1) <> ''
    and lower(btrim(genre_l1)) not in ('all', 'uncategorized')
    and genre_l2 is not null
    and btrim(genre_l2) <> ''
    and lower(btrim(genre_l2)) not in ('all', 'uncategorized')
  group by btrim(genre_l1), btrim(genre_l2)
  order by btrim(genre_l1) asc, coalesce(sum(playing), 0) desc, btrim(genre_l2) asc;
$$;

revoke all on function public.get_stats_subgenre_options() from public, anon, authenticated;
grant execute on function public.get_stats_subgenre_options() to service_role;

do $migration$
declare
  function_sql text;
begin
  select pg_get_functiondef('public.refresh_stats_current_indexes()'::regprocedure)
    into function_sql;

  if function_sql is null then
    raise exception 'public.refresh_stats_current_indexes() is missing';
  end if;

  function_sql := replace(
    function_sql,
    $$coalesce(genre_l1, genre, 'Uncategorized')$$,
    $$coalesce(nullif(btrim(genre_l1), ''), 'Uncategorized')$$
  );

  function_sql := replace(
    function_sql,
    $$coalesce(genre_l1, genre) as genre,$$,
    $$nullif(btrim(genre_l1), '') as genre,$$
  );

  execute function_sql;
end;
$migration$;
