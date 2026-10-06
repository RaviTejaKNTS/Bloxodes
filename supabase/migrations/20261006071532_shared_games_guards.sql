begin;
create or replace view public.game_wiki_pages_view with(security_invoker=true) as select w.*, greatest(w.updated_at,coalesce(w.published_at,w.updated_at)) content_updated_at,g.title game_title,g.short_title game_short_title,g.installment game_installment,g.content_kind game_content_kind,g.parent_game_id game_parent_game_id,g.kind game_kind,g.parent_id,g.developer game_developer,g.publisher game_publisher,g.description_md game_description_md,g.cover_image game_cover_image,g.hero_image game_hero_image,g.official_url game_official_url,g.release_dates_json game_release_dates_json,g.platforms_json game_platforms_json,g.status game_status from public.game_wiki_pages w join public.games g on g.id=w.game_id where g.is_published and not exists(select 1 from public.games parent where parent.id=g.parent_id and not parent.is_published);
create or replace view public.game_collection_pages_view with(security_invoker=true) as select p.*,greatest(p.updated_at,coalesce(p.published_at,p.updated_at)) content_updated_at,g.title game_title,g.short_title game_short_title,g.content_kind game_content_kind,g.parent_game_id game_parent_game_id,g.cover_image game_cover_image,g.hero_image game_hero_image from public.game_collection_pages p join public.games g on g.id=p.game_id join public.game_wiki_pages w on w.id=p.wiki_page_id where g.is_published and w.is_published and not exists(select 1 from public.games parent where parent.id=g.parent_id and not parent.is_published);
create or replace view public.game_tool_pages_view with(security_invoker=true) as select p.*,greatest(p.updated_at,coalesce(p.published_at,p.updated_at)) content_updated_at from public.game_tool_pages p join public.games g on g.id=p.game_id where g.is_published and not exists(select 1 from public.games parent where parent.id=g.parent_id and not parent.is_published);
create or replace view public.game_checklist_pages_view with(security_invoker=true) as select p.*,g.title game_title,g.slug game_slug,g.hero_image image,(select count(*) from public.game_checklist_items i where i.page_id=p.id and cardinality(string_to_array(i.section_code,'.'))=3) leaf_item_count,greatest(p.updated_at,(select max(i.updated_at) from public.game_checklist_items i where i.page_id=p.id)) content_updated_at from public.game_checklist_pages p join public.games g on g.id=p.game_id where p.is_public and p.published_at<=now() and g.is_published and not exists(select 1 from public.games parent where parent.id=g.parent_id and not parent.is_published);
create view public.game_code_pages_view with(security_invoker=true) as select p.* from public.game_code_pages p join public.games g on g.id=p.game_id where g.is_published and not exists(select 1 from public.games parent where parent.id=g.parent_id and not parent.is_published);
revoke all on public.game_code_pages_view from anon,authenticated; grant select on public.game_code_pages_view to service_role;
alter table public.game_collection_progress add foreign key(user_id) references public.app_users(user_id) on delete cascade;
alter table public.game_collection_progress add foreign key(namespace,collection_code) references public.game_collection_pages(namespace,code) on delete cascade;
alter table public.game_releases drop constraint minecraft_releases_edition_check;
alter table public.game_releases add check(length(trim(edition))>0);
alter table public.game_releases add foreign key(game_id,namespace) references public.games(id,namespace);
alter table public.game_tool_pages alter column game_id set not null;
alter table public.game_tool_pages add foreign key(game_id,namespace) references public.games(id,namespace);
alter table public.game_collection_pages add foreign key(game_id,namespace) references public.games(id,namespace);
create index game_items_namespace_dataset_idx on public.game_collection_items(namespace,dataset_id,sort_order,item_slug);
create index game_datasets_namespace_owner_idx on public.game_collection_datasets(namespace,collection_page_id);
create index game_checklist_items_owner_idx on public.game_checklist_items(page_id);
create index game_tools_owner_idx on public.game_tool_pages(game_id,namespace);
create index game_releases_owner_idx on public.game_releases(game_id,namespace);
create index game_progress_collection_idx on public.game_collection_progress(namespace,collection_code);
create index game_codes_owner_idx on public.game_codes(code_page_id);
create index game_collection_wiki_idx on public.game_collection_pages(wiki_page_id,game_id);
create index game_collection_published_idx on public.game_collection_pages(published_dataset_id,id);
create or replace function public.validate_game_collection_publication() returns trigger language plpgsql set search_path='' as $$
declare expected_count integer; actual_count integer;
begin
 if new.is_published then
  if new.published_dataset_id is null then raise exception 'Published collections require a dataset'; end if;
  select item_count into expected_count from public.game_collection_datasets where id=new.published_dataset_id and collection_page_id=new.id for update;
  select count(*) into actual_count from public.game_collection_items where dataset_id=new.published_dataset_id;
  if expected_count is null or expected_count<>actual_count or new.item_count<>actual_count or actual_count=0 then raise exception 'Collection publication count or ownership mismatch'; end if;
 end if;
 return new;
end $$;
create function public.trg_game_codes_changed() returns trigger language plpgsql set search_path='' as $$
declare owner_id uuid; page_path text;
begin
 owner_id:=case when tg_op='DELETE' then old.code_page_id else new.code_page_id end;
 select canonical_path into page_path from public.game_code_pages where id=owner_id;
 if page_path is not null then perform public.enqueue_revalidation('game_content',ltrim(page_path,'/'),'game_codes_'||lower(tg_op)); end if;
 if tg_op='UPDATE' and old.code_page_id<>new.code_page_id then
  select canonical_path into page_path from public.game_code_pages where id=old.code_page_id;
  if page_path is not null then perform public.enqueue_revalidation('game_content',ltrim(page_path,'/'),'game_codes_update'); end if;
 end if;
 return null;
end $$;
create trigger game_codes_changed after insert or update or delete on public.game_codes for each row execute function public.trg_game_codes_changed();
create function public.protect_game_identity() returns trigger language plpgsql set search_path='' as $$
begin
 if tg_op='UPDATE' and (new.namespace<>old.namespace or new.slug<>old.slug or new.kind<>old.kind or new.parent_id is distinct from old.parent_id) then raise exception 'Game identity is permanent; use a reviewed route migration'; end if;
 return new;
end $$;
create trigger protect_game_identity before update on public.games for each row execute function public.protect_game_identity();
create or replace function public.trg_game_content_changed() returns trigger language plpgsql set search_path='' as $$
declare ns text; old_path text; new_path text; target_id text; target_type text; roots text[];
begin
 ns:=case when tg_op='DELETE' then old.namespace else new.namespace end;
 if tg_table_name='games' then
  perform public.refresh_game_content_index(ns);
  for new_path in select canonical_path from public.game_wiki_pages where namespace=ns union select canonical_path from public.game_collection_pages where namespace=ns union select canonical_path from public.game_tool_pages where namespace=ns union select canonical_path from public.game_checklist_pages where namespace=ns union select canonical_path from public.game_code_pages where namespace=ns loop
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


commit;
