begin;

create index if not exists gta_wiki_collection_pages_wiki_game_idx
  on public.gta_wiki_collection_pages (wiki_page_id, game_id);

commit;
