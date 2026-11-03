begin;

-- Run before the table-locking moves below. #170 must have committed in a
-- previous release: its moved namespaces are included by this root inventory.
-- Rewriting an already rewritten namespace is safe and changes no URLs.
do $$
declare
  root record;
begin
  for root in
    select namespace from public.games
    where parent_id is null and url_style = 'page_type'
      and namespace not in ('gta', 'red-dead', 'minecraft')
    order by namespace
  loop
    perform public.rewrite_moved_game_links(root.namespace);
  end loop;
end $$;

commit;
