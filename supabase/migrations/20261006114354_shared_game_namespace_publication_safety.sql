alter table public.games add constraint games_progress_namespace_check check(namespace<>'wiki-collection');

create or replace function public.publish_game_content_batch(target_namespace text,payload jsonb,apply_changes boolean default false) returns jsonb language plpgsql security definer set search_path='' as $$
declare group_name text; table_name text; conflict_columns text; row_value jsonb; columns_sql text; updates_sql text; result_id uuid; results jsonb:='[]'::jsonb;
begin
 if target_namespace !~ '^[a-z0-9]+(-[a-z0-9]+)*$' or target_namespace='roblox' then raise exception 'Invalid game namespace'; end if;
 if jsonb_typeof(payload) is distinct from 'object' or payload='{}'::jsonb or exists(select 1 from jsonb_object_keys(payload) key where key not in ('games','wiki','codesPages','tools','maps','quizzes','catalog','checklists','checklistItems','codes')) then raise exception 'Invalid game publication groups'; end if;
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('game-publish:'||target_namespace,0));
 begin
  foreach group_name in array array['games','wiki','codesPages','tools','maps','quizzes','catalog','checklists','checklistItems','codes'] loop
   if not payload ? group_name then continue; end if;
   if jsonb_typeof(payload->group_name) is distinct from 'array' or jsonb_array_length(payload->group_name)=0 then raise exception 'Invalid % rows',group_name; end if;
   case group_name
    when 'games' then table_name:='games';conflict_columns:='namespace,slug,kind';
    when 'wiki' then table_name:='game_wiki_pages';conflict_columns:='game_id';
    when 'codesPages' then table_name:='game_code_pages';conflict_columns:='game_id';
    when 'tools' then table_name:='game_tool_pages';conflict_columns:='namespace,slug';
    when 'maps' then table_name:='game_map_pages';conflict_columns:='namespace,slug';
    when 'quizzes' then table_name:='game_quiz_pages';conflict_columns:='namespace,slug';
    when 'catalog' then table_name:='game_catalog_pages';conflict_columns:='namespace,slug';
    when 'checklists' then table_name:='game_checklist_pages';conflict_columns:='namespace,slug';
    when 'checklistItems' then table_name:='game_checklist_items';conflict_columns:='page_id,item_key';
    else table_name:='game_codes';conflict_columns:='code_page_id,code';
   end case;
   for row_value in select value from jsonb_array_elements(payload->group_name) loop
    if jsonb_typeof(row_value) is distinct from 'object' or row_value='{}'::jsonb then raise exception 'Invalid % row',group_name; end if;
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
  if exists(select 1 from public.game_checklist_pages p where p.namespace=target_namespace and p.is_public and p.id in (select (entry->>'id')::uuid from jsonb_array_elements(results) entry where entry->>'group'='checklists' union select i.page_id from public.game_checklist_items i join jsonb_array_elements(results) entry on i.id=(entry->>'id')::uuid where entry->>'group'='checklistItems') and not exists(select 1 from public.game_checklist_items i where i.page_id=p.id and cardinality(string_to_array(i.section_code,'.'))=3)) then raise exception 'Public checklists need checkable tasks'; end if;
  if apply_changes is not true then raise exception 'Validated rollback-only publication' using errcode='PT001'; end if;
 exception when sqlstate 'PT001' then null;
 end;
 return jsonb_build_object('applied',coalesce(apply_changes,false),'rows',results);
end $$;
