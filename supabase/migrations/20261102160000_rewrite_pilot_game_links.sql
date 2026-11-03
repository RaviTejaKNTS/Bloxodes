begin;

-- Keep this row-lock-only rewrite BEFORE the batch move. The release runner
-- applies pending migrations in one transaction and retains locks until commit.
select public.rewrite_moved_game_links('peak')
where exists (select 1 from public.games where namespace = 'peak' and url_style = 'page_type')
  and not exists (select 1 from public.games where namespace = 'peak' and url_style <> 'page_type');

select public.rewrite_moved_game_links('risk-of-rain')
where exists (select 1 from public.games where namespace = 'risk-of-rain' and url_style = 'page_type')
  and not exists (select 1 from public.games where namespace = 'risk-of-rain' and url_style <> 'page_type');

commit;
