begin;

-- Strict calls: missing roots, unexpected Minecraft archive data and route
-- collisions abort the release. The specialized renderers are already live.
select public.move_game_namespace_to_page_type_urls('gta');
select public.move_game_namespace_to_page_type_urls('red-dead');
select public.move_game_namespace_to_page_type_urls('minecraft');

-- Rewrite these three namespaces' stored links only in a later release,
-- after this transaction commits. Do not add a rewrite after these moves.
commit;
