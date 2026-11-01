begin;

-- 20261102130000 checked the archived Minecraft child before a new child
-- inherited its root's URL style, so inserting any child named `minecraft`
-- under a namespace-style root was refused. Check after inheritance.
create or replace function public.prepare_game_content() returns trigger language plpgsql set search_path='' as $$
declare g public.games; wiki public.game_wiki_pages; expected text; typ text; slug_value text;
begin
 if tg_table_name='games' then
  if tg_op='UPDATE' and new.url_style is distinct from old.url_style and current_setting('bloxodes.url_move_namespace',true) is distinct from new.namespace then raise exception 'Change URL style only through move_game_namespace_to_page_type_urls'; end if;
  if new.kind='game' and new.parent_id is null then select id into new.parent_id from public.games where namespace=new.namespace and kind='franchise'; end if;
  if new.parent_id is not null then
   select * into g from public.games where id=new.parent_id and kind='franchise' and namespace=new.namespace;
   if not found then raise exception 'Game parent must be its franchise'; end if;
   if tg_op='INSERT' then new.url_style:=g.url_style; end if;
  end if;
  -- After inheritance: a new child's style comes from its root, not the column default.
  if new.namespace='minecraft' and new.slug='minecraft' and new.parent_id is not null and new.url_style='page_type' and new.is_published then raise exception 'Legacy Minecraft must remain unpublished'; end if;
  return new;
 end if;
 select * into strict g from public.games where id=new.game_id;
 if new.namespace<>g.namespace then raise exception 'Page game ownership mismatch'; end if;
 typ:=replace(replace(tg_table_name,'game_',''),'_pages','');
 slug_value:=to_jsonb(new)->>'slug';
 if typ='collection' then
  select * into strict wiki from public.game_wiki_pages where id=new.wiki_page_id;
  if new.game_id<>wiki.game_id or new.namespace<>wiki.namespace or new.wiki_slug<>wiki.slug then raise exception 'Collection wiki ownership mismatch'; end if;
  if tg_op='UPDATE' and (new.wiki_page_id is distinct from old.wiki_page_id or new.wiki_slug is distinct from old.wiki_slug) then raise exception 'Collection route identity is permanent'; end if;
  slug_value:=new.collection_slug;
 end if;
 expected:=public.expected_game_page_path(new.game_id,typ,slug_value);
 if new.canonical_path is null then new.canonical_path:=expected; end if;
 if new.canonical_path is distinct from expected then raise exception 'Page route does not match its game and page type: expected %',expected; end if;
 if tg_op='UPDATE' and (new.namespace<>old.namespace or new.game_id<>old.game_id or (to_jsonb(new)->>'slug') is distinct from (to_jsonb(old)->>'slug') or (to_jsonb(new)->>'collection_slug') is distinct from (to_jsonb(old)->>'collection_slug')) then raise exception 'Page ownership and slug are permanent'; end if;
 if typ='checklist' then
  if new.is_public and new.published_at is null then new.published_at:=now(); end if;
 else
  if new.is_published and new.published_at is null then new.published_at:=now(); end if;
 end if;
 return new;
end $$;

commit;
