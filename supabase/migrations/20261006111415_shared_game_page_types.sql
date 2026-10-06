begin;
-- Keep every non-Roblox page owned by the shared game registry.
create table public.game_map_pages (
 id uuid primary key default gen_random_uuid(), namespace text not null, game_id uuid not null,
 slug text not null check(slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'), title text not null check(length(btrim(title))>0),
 seo_title text, meta_description text, intro_md text, description_md text,
 sources_json jsonb not null default '[]' check(jsonb_typeof(sources_json)='array'),
 renderer_key text not null default 'image-pins' check(renderer_key in ('image-pins','gta-layered','gta5')),map_data jsonb not null default '{}' check(jsonb_typeof(map_data)='object'),
 canonical_path text not null unique, is_published boolean not null default false,
 published_at timestamptz, created_at timestamptz not null default now(),updated_at timestamptz not null default now(),
 unique(namespace,slug), unique(id,namespace), foreign key(game_id,namespace) references public.games(id,namespace)
);
create index game_map_owner_idx on public.game_map_pages(game_id,namespace);
alter table public.game_map_pages enable row level security;
revoke all on public.game_map_pages from public,anon,authenticated;
grant all on public.game_map_pages to service_role;
create view public.game_map_pages_view with(security_invoker=true) as
 select p.*, g.title game_title,g.slug game_slug from public.game_map_pages p join public.games g on g.id=p.game_id
 where p.is_published and g.is_published and (p.published_at is null or p.published_at<=now())
 and not exists(select 1 from public.games parent where parent.id=g.parent_id and not parent.is_published);
revoke all on public.game_map_pages_view from public,anon,authenticated;
grant select on public.game_map_pages_view to service_role;
create table public.game_quiz_pages (
 id uuid primary key default gen_random_uuid(), namespace text not null, game_id uuid not null,
 slug text not null check(slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'), title text not null check(length(btrim(title))>0),
 seo_title text, meta_description text, intro_md text, description_md text,
 sources_json jsonb not null default '[]' check(jsonb_typeof(sources_json)='array'),
 quiz_data jsonb not null default '{}' check(jsonb_typeof(quiz_data)='object'),
 canonical_path text not null unique, is_published boolean not null default false,
 published_at timestamptz, created_at timestamptz not null default now(),updated_at timestamptz not null default now(),
 unique(namespace,slug), unique(id,namespace), foreign key(game_id,namespace) references public.games(id,namespace)
);
create index game_quiz_owner_idx on public.game_quiz_pages(game_id,namespace);
alter table public.game_quiz_pages enable row level security;
revoke all on public.game_quiz_pages from public,anon,authenticated;
grant all on public.game_quiz_pages to service_role;
create view public.game_quiz_pages_view with(security_invoker=true) as
 select p.*, g.title game_title,g.slug game_slug from public.game_quiz_pages p join public.games g on g.id=p.game_id
 where p.is_published and g.is_published and (p.published_at is null or p.published_at<=now())
 and not exists(select 1 from public.games parent where parent.id=g.parent_id and not parent.is_published);
revoke all on public.game_quiz_pages_view from public,anon,authenticated;
grant select on public.game_quiz_pages_view to service_role;
create table public.game_catalog_pages (
 id uuid primary key default gen_random_uuid(), namespace text not null, game_id uuid not null,
 slug text not null check(slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'), title text not null check(length(btrim(title))>0),
 seo_title text, meta_description text, intro_md text, description_md text,
 sources_json jsonb not null default '[]' check(jsonb_typeof(sources_json)='array'),
 catalog_data jsonb not null default '{}' check(jsonb_typeof(catalog_data)='object'),
 canonical_path text not null unique, is_published boolean not null default false,
 published_at timestamptz, created_at timestamptz not null default now(),updated_at timestamptz not null default now(),
 unique(namespace,slug), unique(id,namespace), foreign key(game_id,namespace) references public.games(id,namespace)
);
create index game_catalog_owner_idx on public.game_catalog_pages(game_id,namespace);
alter table public.game_catalog_pages enable row level security;
revoke all on public.game_catalog_pages from public,anon,authenticated;
grant all on public.game_catalog_pages to service_role;
create view public.game_catalog_pages_view with(security_invoker=true) as
 select p.*, g.title game_title,g.slug game_slug from public.game_catalog_pages p join public.games g on g.id=p.game_id
 where p.is_published and g.is_published and (p.published_at is null or p.published_at<=now())
 and not exists(select 1 from public.games parent where parent.id=g.parent_id and not parent.is_published);
revoke all on public.game_catalog_pages_view from public,anon,authenticated;
grant select on public.game_catalog_pages_view to service_role;
create function public.valid_game_page_data(kind text,data jsonb) returns boolean language plpgsql immutable set search_path='' as $$
declare entry jsonb; question jsonb; option_data jsonb; seen text[]:='{}'; option_ids text[]; level_name text; columns_keys text[]:='{}';
begin
 if jsonb_typeof(data) is distinct from 'object' or octet_length(data::text)>4194304 then return false; end if;
 if kind='map' then
  if jsonb_typeof(data->'width') is distinct from 'number' or jsonb_typeof(data->'height') is distinct from 'number' or coalesce(data->>'attribution','')='' or jsonb_typeof(data->'markers') is distinct from 'array' or jsonb_array_length(data->'markers')<1 or jsonb_array_length(data->'markers')>10000 or coalesce(data->>'image','')!~ '^(https://[^[:space:]]+|/[a-zA-Z0-9/_.,%=-]+)$' or not ((data->>'width')::numeric>0 and (data->>'height')::numeric>0) then return false; end if;
  for entry in select value from jsonb_array_elements(data->'markers') loop
   if jsonb_typeof(entry->'id') is distinct from 'string' or jsonb_typeof(entry->'title') is distinct from 'string' or jsonb_typeof(entry->'x') is distinct from 'number' or jsonb_typeof(entry->'y') is distinct from 'number' or coalesce(entry->>'id','')='' or coalesce(entry->>'title','')='' or entry->>'id'=any(seen) or not ((entry->>'x')::numeric between 0 and 100 and (entry->>'y')::numeric between 0 and 100) then return false; end if;
   if entry ? 'href' and coalesce(entry->>'href','')!~ '^(/[a-zA-Z0-9/_.,%#?=&-]+|https://[^[:space:]]+)$' then return false; end if;
   seen:=array_append(seen,entry->>'id');
  end loop;
 elsif kind='quiz' then
  foreach level_name in array array['easy','medium','hard'] loop
   if jsonb_typeof(data->level_name) is distinct from 'array' or jsonb_array_length(data->level_name)<1 or jsonb_array_length(data->level_name)>1000 then return false; end if;
   for question in select value from jsonb_array_elements(data->level_name) loop
    if jsonb_typeof(question->'id') is distinct from 'string' or jsonb_typeof(question->'question') is distinct from 'string' or coalesce(question->>'id','')='' or question->>'id'=any(seen) or coalesce(question->>'question','')='' or jsonb_typeof(question->'options') is distinct from 'array' or jsonb_array_length(question->'options')<>4 then return false; end if;
    if question ? 'image' and jsonb_typeof(question->'image')<>'null' and coalesce(question->>'image','')!~ '^(https://[^[:space:]]+|/[a-zA-Z0-9/_.,%#?=&-]+)$' then return false; end if;
    seen:=array_append(seen,question->>'id'); option_ids:='{}';
    for option_data in select value from jsonb_array_elements(question->'options') loop
     if jsonb_typeof(option_data->'id') is distinct from 'string' or jsonb_typeof(option_data->'text') is distinct from 'string' or coalesce(option_data->>'id','')='' or coalesce(option_data->>'text','')='' or option_data->>'id'=any(option_ids) then return false; end if;
     option_ids:=array_append(option_ids,option_data->>'id');
    end loop;
    if not coalesce(question->>'correctOptionId'=any(option_ids),false) then return false; end if;
   end loop;
  end loop;
 elsif kind='catalog' then
  if jsonb_typeof(data->'columns') is distinct from 'array' or jsonb_array_length(data->'columns')<1 or jsonb_array_length(data->'columns')>30 or jsonb_typeof(data->'items') is distinct from 'array' or jsonb_array_length(data->'items')<1 or jsonb_array_length(data->'items')>10000 then return false; end if;
  for entry in select value from jsonb_array_elements(data->'columns') loop
   if jsonb_typeof(entry->'key') is distinct from 'string' or jsonb_typeof(entry->'label') is distinct from 'string' or entry->>'key'='id' or coalesce(entry->>'key','')!~ '^[a-z][a-z0-9_]*$' or coalesce(entry->>'label','')='' or entry->>'key'=any(columns_keys) then return false; end if;
   columns_keys:=array_append(columns_keys,entry->>'key');
  end loop;
  for entry in select value from jsonb_array_elements(data->'items') loop
   if jsonb_typeof(entry) is distinct from 'object' or jsonb_typeof(entry->'id') is distinct from 'string' or coalesce(entry->>'id','')='' or entry->>'id'=any(seen) or exists(select 1 from jsonb_each(entry) fields where fields.key<>'id' and (not fields.key=any(columns_keys) or jsonb_typeof(fields.value) not in ('string','number','boolean','null'))) then return false; end if;
   seen:=array_append(seen,entry->>'id');
  end loop;
 else return false;
 end if;
 return true;
exception when others then return false;
end $$;
revoke all on function public.valid_game_page_data(text,jsonb) from public,anon,authenticated;
grant execute on function public.valid_game_page_data(text,jsonb) to service_role;
alter table public.game_map_pages add check(namespace='gta' or renderer_key='image-pins'), add check(not is_published or (renderer_key='image-pins' and public.valid_game_page_data('map',map_data)) or (namespace='gta' and renderer_key in ('gta-layered','gta5') and map_data<>'{}'::jsonb));
alter table public.game_quiz_pages add check(not is_published or public.valid_game_page_data('quiz',quiz_data));
alter table public.game_catalog_pages add check(not is_published or public.valid_game_page_data('catalog',catalog_data));
create table public.game_quiz_progress (
 user_id uuid not null references public.app_users(user_id) on delete cascade,
 quiz_page_id uuid not null, namespace text not null,
 seen_question_ids text[] not null default '{}', last_score integer, last_total integer,
 last_breakdown jsonb not null default '{}', last_attempt_at timestamptz,
 created_at timestamptz not null default now(),updated_at timestamptz not null default now(),
 primary key(user_id,quiz_page_id),foreign key(quiz_page_id,namespace) references public.game_quiz_pages(id,namespace) on delete cascade,
 check(last_score>=0 and last_total>=last_score)
);
alter table public.game_quiz_progress enable row level security;
revoke all on public.game_quiz_progress from public,anon,authenticated;
grant all on public.game_quiz_progress to service_role;
create index game_quiz_progress_owner_idx on public.game_quiz_progress(quiz_page_id,namespace);
create trigger touch_game_quiz_progress before update on public.game_quiz_progress for each row execute function public.game_content_touch();

create function public.prepare_game_extended_page() returns trigger language plpgsql set search_path='' as $$
declare section_name text; expected text;
begin
 section_name:=case tg_table_name when 'game_map_pages' then 'maps' when 'game_quiz_pages' then 'quizzes' else 'catalog' end;
 expected:='/'||new.namespace||'/'||section_name||'/'||new.slug;
 if exists(select 1 from jsonb_array_elements(new.sources_json) source where jsonb_typeof(source) is distinct from 'object' or jsonb_typeof(source->'title') is distinct from 'string' or coalesce(source->>'url','')!~ '^https://[^[:space:]]+$') then raise exception 'Sources need a title and HTTPS URL'; end if;
 if tg_op='UPDATE' and (new.namespace<>old.namespace or new.game_id<>old.game_id or new.slug<>old.slug or new.canonical_path<>old.canonical_path) then raise exception 'Page ownership and route are permanent'; end if;
 if new.canonical_path is null then new.canonical_path:=expected; end if;
 if new.canonical_path<>expected then raise exception 'Page route does not match its game and page type'; end if;
 if new.is_published and new.published_at is null then new.published_at:=now(); end if;
 new.updated_at:=now();
 return new;
end $$;
create trigger prepare_game_extended_page before insert or update on public.game_map_pages for each row execute function public.prepare_game_extended_page();
create trigger game_content_changed after insert or update or delete on public.game_map_pages for each row execute function public.trg_game_content_changed();
create trigger prepare_game_extended_page before insert or update on public.game_quiz_pages for each row execute function public.prepare_game_extended_page();
create trigger game_content_changed after insert or update or delete on public.game_quiz_pages for each row execute function public.trg_game_content_changed();
create trigger prepare_game_extended_page before insert or update on public.game_catalog_pages for each row execute function public.prepare_game_extended_page();
create trigger game_content_changed after insert or update or delete on public.game_catalog_pages for each row execute function public.trg_game_content_changed();
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
  if apply_changes is not true then raise exception 'Validated rollback-only publication' using errcode='PT001'; end if;
 exception when sqlstate 'PT001' then null;
 end;
 return jsonb_build_object('applied',coalesce(apply_changes,false),'rows',results);
end $$;
create or replace function public.refresh_game_content_index(target_namespace text) returns void language plpgsql set search_path='' as $$
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
  union all
  select p.id,p.namespace,p.slug,p.title,p.meta_description,p.canonical_path,p.updated_at,p.is_published and g.is_published and coalesce(parent.is_published,true) and coalesce(p.published_at<=now(),true),'map' from public.game_map_pages p join public.games g on g.id=p.game_id left join public.games parent on parent.id=g.parent_id where p.namespace=target_namespace
  union all
  select p.id,p.namespace,p.slug,p.title,p.meta_description,p.canonical_path,p.updated_at,p.is_published and g.is_published and coalesce(parent.is_published,true) and coalesce(p.published_at<=now(),true),'quiz' from public.game_quiz_pages p join public.games g on g.id=p.game_id left join public.games parent on parent.id=g.parent_id where p.namespace=target_namespace
  union all
  select p.id,p.namespace,p.slug,p.title,p.meta_description,p.canonical_path,p.updated_at,p.is_published and g.is_published and coalesce(parent.is_published,true) and coalesce(p.published_at<=now(),true),'catalog' from public.game_catalog_pages p join public.games g on g.id=p.game_id left join public.games parent on parent.id=g.parent_id where p.namespace=target_namespace
 loop
  entity_kind:=case when row_data.page_kind='wiki' and row_data.namespace in ('gta','red-dead','minecraft') then replace(row_data.namespace,'-','_')||'_wiki' when row_data.page_kind='collection' and row_data.namespace in ('gta','red-dead','minecraft') then replace(row_data.namespace,'-','_')||'_wiki_collection' when row_data.page_kind='tool' and row_data.namespace='minecraft' then 'minecraft_tool' when row_data.page_kind='checklist' and row_data.namespace='gta' then 'gta_checklist' else 'game_'||row_data.page_kind end;
  perform public.upsert_search_index(entity_kind,row_data.id::text,row_data.slug,row_data.title,row_data.namespace||' '||row_data.page_kind,row_data.canonical_path,row_data.updated_at,row_data.visible,left(concat_ws(' ',row_data.title,row_data.summary,row_data.slug),4000));
 end loop;
end $$;
create or replace function public.trg_game_content_changed() returns trigger language plpgsql set search_path='' as $$
declare ns text; old_path text; new_path text; target_id text; target_type text; roots text[];
begin
 ns:=case when tg_op='DELETE' then old.namespace else new.namespace end;
 if tg_table_name='games' then
  perform public.refresh_game_content_index(ns);
  for new_path in select canonical_path from public.game_wiki_pages where namespace=ns union select canonical_path from public.game_collection_pages where namespace=ns union select canonical_path from public.game_tool_pages where namespace=ns union select canonical_path from public.game_checklist_pages where namespace=ns union select canonical_path from public.game_code_pages where namespace=ns union select canonical_path from public.game_map_pages where namespace=ns union select canonical_path from public.game_quiz_pages where namespace=ns union select canonical_path from public.game_catalog_pages where namespace=ns loop
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
revoke all on function public.prepare_game_extended_page() from public,anon,authenticated;
notify pgrst, 'reload schema';
commit;
