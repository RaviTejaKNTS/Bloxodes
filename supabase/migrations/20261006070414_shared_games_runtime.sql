begin;

alter table public.comments drop constraint comments_entity_type_check;
alter table public.comments add constraint comments_entity_type_check check(entity_type in ('code','article','catalog','event','tool','wiki','wiki_collection','gta_wiki','gta_wiki_collection','red_dead_wiki','red_dead_wiki_collection','minecraft_wiki','minecraft_wiki_collection','minecraft_tool','game_wiki','game_collection','game_tool','game_code'));
alter table public.revalidation_events drop constraint revalidation_events_entity_type_check;
alter table public.revalidation_events add constraint revalidation_events_entity_type_check check(entity_type in ('code','article','author','event','checklist','tool','catalog','music','quiz','wiki','wiki_collection','stats','puzzle','gta_game','gta_wiki','gta_wiki_collection','gta_checklist','red_dead_game','red_dead_wiki','red_dead_wiki_collection','minecraft_game','minecraft_wiki','minecraft_wiki_collection','minecraft_tool','game_content'));

create function public.refresh_game_content_index(target_namespace text) returns void language plpgsql set search_path='' as $$
declare row_data record; entity_kind text;
begin
 for row_data in
  select w.id,w.namespace,w.slug,w.title,w.meta_description summary,w.canonical_path,w.updated_at,w.is_published and g.is_published and coalesce(parent.is_published,true) visible,'wiki' page_kind from public.game_wiki_pages w join public.games g on g.id=w.game_id left join public.games parent on parent.id=g.parent_id where w.namespace=target_namespace
  union all
  select p.id,p.namespace,p.code,p.title,p.meta_description,p.canonical_path,p.updated_at,p.is_published and w.is_published and g.is_published and coalesce(parent.is_published,true) and p.published_dataset_id is not null,'collection' from public.game_collection_pages p join public.game_wiki_pages w on w.id=p.wiki_page_id join public.games g on g.id=p.game_id left join public.games parent on parent.id=g.parent_id where p.namespace=target_namespace
  union all
  select p.id,p.namespace,p.slug,p.title,p.meta_description,p.canonical_path,p.updated_at,p.is_published and g.is_published and coalesce(parent.is_published,true),'tool' from public.game_tool_pages p join public.games g on g.id=p.game_id left join public.games parent on parent.id=g.parent_id where p.namespace=target_namespace
  union all
  select p.id,p.namespace,p.slug,p.title,p.meta_description,p.canonical_path,p.updated_at,p.is_published and g.is_published and coalesce(parent.is_published,true),'code' from public.game_code_pages p join public.games g on g.id=p.game_id left join public.games parent on parent.id=g.parent_id where p.namespace=target_namespace
  union all
  select p.id,p.namespace,p.slug,p.title,p.seo_description,p.canonical_path,p.updated_at,p.is_public and p.published_at<=now() and g.is_published and coalesce(parent.is_published,true),'checklist' from public.game_checklist_pages p join public.games g on g.id=p.game_id left join public.games parent on parent.id=g.parent_id where p.namespace=target_namespace
 loop
  entity_kind:=case when row_data.page_kind='wiki' and row_data.namespace in ('gta','red-dead','minecraft') then replace(row_data.namespace,'-','_')||'_wiki' when row_data.page_kind='collection' and row_data.namespace in ('gta','red-dead','minecraft') then replace(row_data.namespace,'-','_')||'_wiki_collection' when row_data.page_kind='tool' and row_data.namespace='minecraft' then 'minecraft_tool' when row_data.page_kind='checklist' and row_data.namespace='gta' then 'gta_checklist' else 'game_'||row_data.page_kind end;
  perform public.upsert_search_index(entity_kind,row_data.id::text,row_data.slug,row_data.title,row_data.namespace||' '||row_data.page_kind,row_data.canonical_path,row_data.updated_at,row_data.visible,left(concat_ws(' ',row_data.title,row_data.summary,row_data.slug),4000));
 end loop;
end $$;
revoke all on function public.refresh_game_content_index(text) from public,anon,authenticated;
grant execute on function public.refresh_game_content_index(text) to service_role;

create function public.trg_game_content_changed() returns trigger language plpgsql set search_path='' as $$
declare ns text; old_path text; new_path text; target_id text; target_type text; roots text[];
begin
 ns:=case when tg_op='DELETE' then old.namespace else new.namespace end;
 if tg_table_name='games' then
  perform public.refresh_game_content_index(ns);
  for new_path in select canonical_path from public.game_wiki_pages where namespace=ns union select canonical_path from public.game_collection_pages where namespace=ns union select canonical_path from public.game_tool_pages where namespace=ns union select canonical_path from public.game_checklist_pages where namespace=ns loop
   perform public.enqueue_revalidation('game_content',ltrim(new_path,'/'),'games_'||lower(tg_op));
  end loop;
 else
  target_id:=case when tg_op='DELETE' then old.id::text else new.id::text end;
  old_path:=case when tg_op in ('DELETE','UPDATE') then old.canonical_path else null end;
  new_path:=case when tg_op='DELETE' then null else new.canonical_path end;
  if tg_op='DELETE' then delete from public.search_index where entity_id=target_id and url=old_path; end if;
  perform public.refresh_game_content_index(ns);
  if old_path is not null then perform public.enqueue_revalidation('game_content',ltrim(old_path,'/'),tg_table_name||'_'||lower(tg_op)); end if;
  if new_path is not null and new_path is distinct from old_path then perform public.enqueue_revalidation('game_content',ltrim(new_path,'/'),tg_table_name||'_'||lower(tg_op)); end if;
 end if;
 perform public.enqueue_revalidation('game_content',ns||'/wiki',tg_table_name||'_'||lower(tg_op));
 return null;
end $$;

create function public.trg_game_data_changed() returns trigger language plpgsql set search_path='' as $$
declare page_id uuid; page_path text;
begin
 page_id:=case when tg_op='DELETE' then old.page_id else new.page_id end;
 select canonical_path into page_path from public.game_checklist_pages where id=page_id;
 if page_path is not null then perform public.enqueue_revalidation('game_content',ltrim(page_path,'/'),'game_checklist_items_'||lower(tg_op)); end if;
 return null;
end $$;
create trigger game_checklist_items_changed after insert or update or delete on public.game_checklist_items for each row execute function public.trg_game_data_changed();

create function public.protect_game_runtime_insert() returns trigger language plpgsql set search_path='' as $$
begin
 perform 1 from public.game_collection_datasets where id=new.dataset_id for update;
 if exists(select 1 from public.game_collection_pages where published_dataset_id=new.dataset_id) then raise exception 'Published collection revisions cannot receive new items'; end if;
 return new;
end $$;
create trigger protect_game_runtime_insert before insert on public.game_collection_items for each row execute function public.protect_game_runtime_insert();

create function public.game_content_touch() returns trigger language plpgsql set search_path='' as $$ begin new.updated_at:=now(); return new; end $$;
create trigger touch_game_codes before update on public.game_code_pages for each row execute function public.game_content_touch();

update public.game_wiki_pages set canonical_path='/minecraft/wiki/legacy-minecraft' where namespace='minecraft' and slug='minecraft';

-- The franchise hub has its own record. Original title and archived wiki IDs stay intact.
insert into public.game_wiki_pages(namespace,game_id,slug,title,meta_description,description_md,is_published)
select namespace,id,namespace||'-hub',title||' Wiki','Browse game wikis and reference collections for '||title||'.',
case namespace when 'gta' then 'Choose a Grand Theft Auto game to find its systems, equipment and collectibles. GTA Online has its own wiki so its progression and content stay separate from the story games.' when 'red-dead' then 'Choose a Red Dead game to find its systems, story missions and collectibles. Red Dead Online has its own wiki for its roles and progression.' else 'Choose Minecraft Java or Bedrock before using a reference. Each edition has its own blocks, recipes and game rules. Java advancements and Bedrock achievements have separate collections.' end,true
from public.games where kind='franchise';

create trigger game_content_changed after insert or update or delete on public.games for each row execute function public.trg_game_content_changed();
create trigger game_content_changed after insert or update or delete on public.game_wiki_pages for each row execute function public.trg_game_content_changed();
create trigger game_content_changed after insert or update or delete on public.game_collection_pages for each row execute function public.trg_game_content_changed();
create trigger game_content_changed after insert or update or delete on public.game_tool_pages for each row execute function public.trg_game_content_changed();
create trigger game_content_changed after insert or update or delete on public.game_code_pages for each row execute function public.trg_game_content_changed();
create trigger game_content_changed after insert or update or delete on public.game_checklist_pages for each row execute function public.trg_game_content_changed();
select public.refresh_game_content_index('gta');
select public.refresh_game_content_index('red-dead');
select public.refresh_game_content_index('minecraft');
create function public.trg_comments_revalidate_game_content() returns trigger language plpgsql set search_path='' as $$
declare row_data jsonb; page_path text;
begin
 row_data:=case when tg_op='DELETE' then to_jsonb(old) else to_jsonb(new) end;
 if row_data->>'entity_type'='game_wiki' then select canonical_path into page_path from public.game_wiki_pages where id=(row_data->>'entity_id')::uuid;
 elsif row_data->>'entity_type'='game_collection' then select canonical_path into page_path from public.game_collection_pages where id=(row_data->>'entity_id')::uuid;
 elsif row_data->>'entity_type'='game_tool' then select canonical_path into page_path from public.game_tool_pages where id=(row_data->>'entity_id')::uuid;
 elsif row_data->>'entity_type'='game_code' then select canonical_path into page_path from public.game_code_pages where id=(row_data->>'entity_id')::uuid;
 end if;
 if page_path is not null then perform public.enqueue_revalidation('game_content',ltrim(page_path,'/'),'comments_'||lower(tg_op)); end if;
 return null;
end $$;
create trigger comments_revalidate_game_content after insert or update or delete on public.comments for each row execute function public.trg_comments_revalidate_game_content();
commit;
