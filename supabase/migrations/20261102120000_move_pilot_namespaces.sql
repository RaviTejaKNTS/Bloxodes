begin;
select public.move_game_namespace_to_page_type_urls('peak');
select public.move_game_namespace_to_page_type_urls('risk-of-rain');
commit;
