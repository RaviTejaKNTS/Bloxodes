drop view if exists public.puzzle_pages_view;
create or replace view public.puzzle_pages_view as
select
  pp.*,
  coalesce(latest.latest_answer_date, null) as latest_answer_date,
  coalesce(latest.latest_fetched_at, null) as latest_fetched_at,
  greatest(
    pp.updated_at,
    coalesce(pp.published_at, pp.updated_at),
    coalesce(latest.latest_fetched_at, pp.updated_at)
  ) as content_updated_at
from public.puzzle_pages pp
left join lateral (
  select
    pa.answer_date as latest_answer_date,
    pa.fetched_at as latest_fetched_at
  from public.puzzle_answers pa
  where pa.puzzle_slug = pp.slug
  order by pa.answer_date desc
  limit 1
) latest on true;
