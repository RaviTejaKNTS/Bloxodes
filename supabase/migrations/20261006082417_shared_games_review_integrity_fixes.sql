begin;
create or replace function public.validate_game_route_identity() returns trigger language plpgsql set search_path='' as $$
declare g public.games%rowtype; wiki public.game_wiki_pages%rowtype; expected text;
begin
 if tg_op='UPDATE' then
  if tg_table_name='game_collection_pages' then
   if new.wiki_page_id<>old.wiki_page_id or new.wiki_slug<>old.wiki_slug or new.collection_slug<>old.collection_slug then raise exception 'Collection route identity is permanent'; end if;
  else
   if new.slug<>old.slug then raise exception 'Page route slug is permanent'; end if;
  end if;
  -- Existing Minecraft edition and archived URLs remain stable during ordinary edits.
  if new.canonical_path=old.canonical_path then return new; end if;
 end if;
 select * into strict g from public.games where id=new.game_id;
 if tg_table_name='game_collection_pages' then
  select * into strict wiki from public.game_wiki_pages where id=new.wiki_page_id;
  expected:=wiki.canonical_path||'/'||new.collection_slug;
 elsif tg_table_name='game_wiki_pages' then
  expected:='/'||new.namespace||'/wiki'||case when g.parent_id is null then '' else '/'||g.slug end;
  if new.namespace='minecraft' and g.slug in ('minecraft-java','minecraft-bedrock') then expected:='/minecraft/'||replace(g.slug,'minecraft-','')||'/wiki'; end if;
 elsif tg_table_name='game_code_pages' then
  expected:='/'||new.namespace||'/codes'||case when g.parent_id is null then '' else '/'||g.slug end;
 elsif tg_table_name='game_tool_pages' then expected:='/'||new.namespace||'/tools/'||new.slug;
 else expected:='/'||new.namespace||'/checklists/'||new.slug;
 end if;
 if new.canonical_path<>expected then raise exception 'Page route does not match its game and page type'; end if;
 -- The namespace lock prevents concurrent claims for the same route across page tables.
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('game-route:'||new.namespace,0));
 if exists(select 1 from (
  select 'game_wiki_pages' as table_name,id,canonical_path from public.game_wiki_pages union all
  select 'game_collection_pages' as table_name,id,canonical_path from public.game_collection_pages union all
  select 'game_code_pages' as table_name,id,canonical_path from public.game_code_pages union all
  select 'game_tool_pages' as table_name,id,canonical_path from public.game_tool_pages union all
  select 'game_checklist_pages' as table_name,id,canonical_path from public.game_checklist_pages
 ) routes where canonical_path=new.canonical_path and (table_name<>tg_table_name or id<>new.id)) then raise exception 'Game route already belongs to another page'; end if;
 return new;
end $$;

create or replace function public.publish_game_content_batch(target_namespace text,payload jsonb,apply_changes boolean default false) returns jsonb language plpgsql security definer set search_path='' as $$
declare group_name text; table_name text; conflict_columns text; row_value jsonb; columns_sql text; updates_sql text; result_id uuid; results jsonb:='[]'::jsonb;
begin
 if target_namespace !~ '^[a-z0-9]+(-[a-z0-9]+)*$' or target_namespace='roblox' then raise exception 'Invalid game namespace'; end if;
 if jsonb_typeof(payload)<>'object' or payload='{}'::jsonb or exists(select 1 from jsonb_object_keys(payload) key where key not in ('games','wiki','codesPages','tools','codes')) then raise exception 'Invalid game publication groups'; end if;
 begin
  foreach group_name in array array['games','wiki','codesPages','tools','codes'] loop
   if not payload ? group_name then continue; end if;
   if jsonb_typeof(payload->group_name)<>'array' or jsonb_array_length(payload->group_name)=0 then raise exception 'Invalid % rows',group_name; end if;
   case group_name
    when 'games' then table_name:='games';conflict_columns:='namespace,slug,kind';
    when 'wiki' then table_name:='game_wiki_pages';conflict_columns:='game_id';
    when 'codesPages' then table_name:='game_code_pages';conflict_columns:='game_id';
    when 'tools' then table_name:='game_tool_pages';conflict_columns:='namespace,slug';
    else table_name:='game_codes';conflict_columns:='code_page_id,code';
   end case;
   for row_value in select value from jsonb_array_elements(payload->group_name) loop
    if jsonb_typeof(row_value)<>'object' or row_value='{}'::jsonb then raise exception 'Invalid % row',group_name; end if;
    if row_value ? 'namespace' and row_value->>'namespace' is distinct from target_namespace then raise exception 'Cross-namespace publication rejected'; end if;
    if group_name='codes' then
     if not exists(select 1 from public.game_code_pages where id=(row_value->>'code_page_id')::uuid and namespace=target_namespace) then raise exception 'Code page ownership mismatch'; end if;
    else row_value:=row_value||jsonb_build_object('namespace',target_namespace); end if;
    if exists(select 1 from jsonb_object_keys(row_value) fields(key) where not exists(select 1 from pg_catalog.pg_attribute a join pg_catalog.pg_class c on c.oid=a.attrelid join pg_catalog.pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relname=table_name and a.attname=key and a.attnum>0 and not a.attisdropped and a.attgenerated='')) then raise exception 'Unknown or generated publication column in %',group_name; end if;
    select string_agg(format('%I',key),',' order by key),string_agg(format('%1$I=excluded.%1$I',key),',' order by key) filter(where key<>'id') into columns_sql,updates_sql from jsonb_object_keys(row_value) fields(key);
    if updates_sql is null then raise exception 'Publication row requires content'; end if;
    execute format('insert into public.%1$I (%2$s) select %2$s from pg_catalog.jsonb_populate_record(null::public.%1$I,$1) on conflict (%3$s) do update set %4$s returning id',table_name,columns_sql,conflict_columns,updates_sql) into result_id using row_value;
    if row_value ? 'id' and (row_value->>'id')::uuid<>result_id then raise exception 'Existing % identity does not match the reviewed ID',group_name; end if;
    if exists(select 1 from jsonb_array_elements(results) prior where prior->>'group'=group_name and prior->>'id'=result_id::text) then raise exception 'Duplicate % row in publication batch',group_name; end if;
    results:=results||jsonb_build_array(jsonb_build_object('group',group_name,'id',result_id));
   end loop;
  end loop;
  if apply_changes is not true then raise exception 'Validated rollback-only publication' using errcode='PT001'; end if;
 exception when sqlstate 'PT001' then null;
 end;
 return jsonb_build_object('applied',coalesce(apply_changes,false),'rows',results);
end $$;

notify pgrst, 'reload schema';
commit;
