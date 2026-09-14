-- Cover the composite title identity foreign key used by GTA checklist pages.
create index gta_checklist_pages_game_slug_idx on public.gta_checklist_pages(game_id, slug);
