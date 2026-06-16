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
    coalesce(genre_l1, genre, 'Uncategorized') as genre,
    genre_l2 as subgenre,
    count(*)::integer as games,
    coalesce(sum(playing), 0)::bigint as playing
  from public.stats_game_current_index
  where genre_l2 is not null
    and btrim(genre_l2) <> ''
  group by coalesce(genre_l1, genre, 'Uncategorized'), genre_l2
  order by coalesce(genre_l1, genre, 'Uncategorized') asc, coalesce(sum(playing), 0) desc, genre_l2 asc;
$$;

revoke all on function public.get_stats_subgenre_options() from public, anon, authenticated;
grant execute on function public.get_stats_subgenre_options() to service_role;
