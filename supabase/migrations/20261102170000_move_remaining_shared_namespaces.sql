begin;

-- GTA, Red Dead and Minecraft keep their namespace URLs for a later release.
-- Rewrite this batch's stored links only in a later release, after this commits.
do $$
declare
  root record;
begin
  for root in
    select id, namespace from public.games
    where parent_id is null and url_style = 'namespace'
      and namespace not in ('gta', 'red-dead', 'minecraft')
    order by namespace
  loop
    if not exists (select 1 from public.game_wiki_pages where game_id = root.id) then
      raise notice 'Skipping namespace without a root wiki: %', root.namespace;
      continue;
    end if;
    perform public.move_game_namespace_to_page_type_urls(root.namespace);
  end loop;
end $$;

commit;
