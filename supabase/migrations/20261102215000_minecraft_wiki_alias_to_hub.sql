begin;

-- /minecraft/wiki was the Minecraft hub. 20261102210000 pointed it at the Java
-- edition; point it at the franchise hub's wiki (/games/minecraft) as before.
do $$ declare w public.game_wiki_pages; begin
 select p.* into strict w from public.game_wiki_pages p
 join public.games g on g.id=p.game_id
 where g.namespace='minecraft' and g.parent_id is null;
 update public.site_routes set source='game',page_type='wiki',page_id=w.id::text,game_id=w.game_id,
  target_url=null,match_type='exact',tail_mode='append',match_self=true,updated_at=now()
 where path='/minecraft/wiki' and status='old';
 if not found then raise exception 'Missing legacy Minecraft wiki route'; end if;
end $$;

commit;
