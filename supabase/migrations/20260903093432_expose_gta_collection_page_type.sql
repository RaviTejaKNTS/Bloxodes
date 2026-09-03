begin;

drop view if exists public.gta_wiki_collection_pages_view;

create view public.gta_wiki_collection_pages_view
with (security_invoker = true)
as
select
  page.*,
  greatest(page.updated_at, coalesce(page.published_at, page.updated_at)) as content_updated_at,
  game.title as game_title,
  game.short_title as game_short_title,
  game.cover_image as game_cover_image,
  game.hero_image as game_hero_image
from public.gta_wiki_collection_pages page
join public.gta_games game on game.id = page.game_id;

revoke all on table public.gta_wiki_collection_pages_view from anon, authenticated;
grant select on table public.gta_wiki_collection_pages_view to anon, authenticated;
grant all on table public.gta_wiki_collection_pages_view to service_role;

notify pgrst, 'reload schema';
commit;
