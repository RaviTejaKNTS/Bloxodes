create or replace function public.safe_game_content_url(value text) returns boolean language plpgsql immutable set search_path='' as $$
declare authority text; hostname text; port_text text;
begin
 if value is null or value ~ '[[:space:]]' or position(chr(92) in value)>0 then return false; end if;
 if value ~ '^/[^/][a-zA-Z0-9/_.,%#?=&-]*$' then return value ~ '^/[a-zA-Z0-9_.,%#?=&-][a-zA-Z0-9/_.,%#?=&-]*$'; end if;
 if value !~ '^https://[a-zA-Z0-9][a-zA-Z0-9.-]*(:[0-9]{1,5})?([/?#].*)?$' then return false; end if;
 authority:=substring(value from '^https://([^/?#]+)');
 hostname:=split_part(authority,':',1); port_text:=nullif(split_part(authority,':',2),'');
 if port_text is not null and port_text::integer>65535 then return false; end if;
 if hostname ~ '^[0-9.]+$' then
  if cardinality(string_to_array(hostname,'.'))<>4 or family(hostname::inet)<>4 then return false; end if;
 elsif hostname !~ '^([a-zA-Z0-9][a-zA-Z0-9-]*[.])*[a-zA-Z][a-zA-Z-]*$' then return false;
 end if;
 return true;
exception when others then return false;
end $$;
revoke all on function public.safe_game_content_url(text) from public,anon,authenticated;
grant execute on function public.safe_game_content_url(text) to service_role;

create or replace function public.valid_game_page_data(kind text,data jsonb) returns boolean language plpgsql immutable set search_path='' as $$
declare entry jsonb; question jsonb; option_data jsonb; seen text[]:='{}'; option_ids text[]; level_name text; columns_keys text[]:='{}';
begin
 if jsonb_typeof(data) is distinct from 'object' or octet_length(data::text)>4194304 then return false; end if;
 if kind='map' then
  if jsonb_typeof(data->'image') is distinct from 'string' or jsonb_typeof(data->'attribution') is distinct from 'string' or jsonb_typeof(data->'width') is distinct from 'number' or jsonb_typeof(data->'height') is distinct from 'number' or coalesce(data->>'attribution','')!~ '[^[:space:]]' or jsonb_typeof(data->'markers') is distinct from 'array' or jsonb_array_length(data->'markers')<1 or jsonb_array_length(data->'markers')>10000 or not public.safe_game_content_url(data->>'image') or not ((data->>'width')::numeric between 0.000001 and 1000000 and (data->>'height')::numeric between 0.000001 and 1000000) then return false; end if;
  for entry in select value from jsonb_array_elements(data->'markers') loop
   if jsonb_typeof(entry->'id') is distinct from 'string' or jsonb_typeof(entry->'title') is distinct from 'string' or jsonb_typeof(entry->'x') is distinct from 'number' or jsonb_typeof(entry->'y') is distinct from 'number' or coalesce(entry->>'id','')!~ '[^[:space:]]' or coalesce(entry->>'title','')!~ '[^[:space:]]' or entry->>'id'=any(seen) or not ((entry->>'x')::numeric between 0 and 100 and (entry->>'y')::numeric between 0 and 100) then return false; end if;
   if entry ? 'href' and (jsonb_typeof(entry->'href') is distinct from 'string' or not public.safe_game_content_url(entry->>'href')) then return false; end if;
   if entry ? 'category' and (jsonb_typeof(entry->'category') is distinct from 'string' or coalesce(entry->>'category','')!~ '[^[:space:]]') then return false; end if;
   if entry ? 'description' and jsonb_typeof(entry->'description') is distinct from 'string' then return false; end if;
   seen:=array_append(seen,entry->>'id');
  end loop;
 elsif kind='quiz' then
  foreach level_name in array array['easy','medium','hard'] loop
   if jsonb_typeof(data->level_name) is distinct from 'array' or jsonb_array_length(data->level_name)<1 or jsonb_array_length(data->level_name)>1000 then return false; end if;
   for question in select value from jsonb_array_elements(data->level_name) loop
    if jsonb_typeof(question->'id') is distinct from 'string' or jsonb_typeof(question->'question') is distinct from 'string' or coalesce(question->>'id','')='' or question->>'id' ~ '^[[:space:]]|[[:space:]]$' or question->>'id'=any(seen) or coalesce(question->>'question','')!~ '[^[:space:]]' or jsonb_typeof(question->'options') is distinct from 'array' or jsonb_array_length(question->'options')<>4 then return false; end if;
    if question ? 'image' and jsonb_typeof(question->'image')<>'null' and (jsonb_typeof(question->'image') is distinct from 'string' or not public.safe_game_content_url(question->>'image')) then return false; end if;
    seen:=array_append(seen,question->>'id'); option_ids:='{}';
    for option_data in select value from jsonb_array_elements(question->'options') loop
     if jsonb_typeof(option_data->'id') is distinct from 'string' or jsonb_typeof(option_data->'text') is distinct from 'string' or coalesce(option_data->>'id','')='' or option_data->>'id' ~ '^[[:space:]]|[[:space:]]$' or coalesce(option_data->>'text','')!~ '[^[:space:]]' or option_data->>'id'=any(option_ids) then return false; end if;
     option_ids:=array_append(option_ids,option_data->>'id');
    end loop;
    if jsonb_typeof(question->'correctOptionId') is distinct from 'string' or not coalesce(question->>'correctOptionId'=any(option_ids),false) then return false; end if;
   end loop;
  end loop;
 elsif kind='catalog' then
  if jsonb_typeof(data->'columns') is distinct from 'array' or jsonb_array_length(data->'columns')<1 or jsonb_array_length(data->'columns')>30 or jsonb_typeof(data->'items') is distinct from 'array' or jsonb_array_length(data->'items')<1 or jsonb_array_length(data->'items')>10000 then return false; end if;
  for entry in select value from jsonb_array_elements(data->'columns') loop
   if jsonb_typeof(entry->'key') is distinct from 'string' or jsonb_typeof(entry->'label') is distinct from 'string' or entry->>'key'='id' or coalesce(entry->>'key','')!~ '^[a-z][a-z0-9_]*$' or coalesce(entry->>'label','')!~ '[^[:space:]]' or entry->>'key'=any(columns_keys) then return false; end if;
   columns_keys:=array_append(columns_keys,entry->>'key');
  end loop;
  for entry in select value from jsonb_array_elements(data->'items') loop
   if jsonb_typeof(entry) is distinct from 'object' or jsonb_typeof(entry->'id') is distinct from 'string' or coalesce(entry->>'id','')!~ '[^[:space:]]' or entry->>'id'=any(seen) or exists(select 1 from jsonb_each(entry) fields where fields.key<>'id' and (not fields.key=any(columns_keys) or jsonb_typeof(fields.value) not in ('string','number','boolean','null') or (jsonb_typeof(fields.value)='number' and abs((fields.value::text)::numeric)>1.7976931348623157e308))) then return false; end if;
   seen:=array_append(seen,entry->>'id');
  end loop;
 else return false;
 end if;
 return true;
exception when others then return false;
end $$;

create or replace function public.publish_game_content_batch(target_namespace text,payload jsonb,apply_changes boolean default false) returns jsonb language plpgsql security definer set search_path='' as $$
declare group_name text; table_name text; conflict_columns text; row_value jsonb; columns_sql text; updates_sql text; result_id uuid; results jsonb:='[]'::jsonb;
begin
 if target_namespace !~ '^[a-z0-9]+(-[a-z0-9]+)*$' or target_namespace='roblox' then raise exception 'Invalid game namespace'; end if;
 if jsonb_typeof(payload) is distinct from 'object' or payload='{}'::jsonb or exists(select 1 from jsonb_object_keys(payload) key where key not in ('games','wiki','codesPages','tools','maps','quizzes','catalog','checklists','checklistItems','codes')) then raise exception 'Invalid game publication groups'; end if;
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
