create function public.safe_game_content_url(value text) returns boolean language plpgsql immutable set search_path='' as $$
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
  if jsonb_typeof(data->'image') is distinct from 'string' or jsonb_typeof(data->'attribution') is distinct from 'string' or jsonb_typeof(data->'width') is distinct from 'number' or jsonb_typeof(data->'height') is distinct from 'number' or coalesce(btrim(data->>'attribution'),'')='' or jsonb_typeof(data->'markers') is distinct from 'array' or jsonb_array_length(data->'markers')<1 or jsonb_array_length(data->'markers')>10000 or not public.safe_game_content_url(data->>'image') or not ((data->>'width')::numeric between 0.000001 and 1000000 and (data->>'height')::numeric between 0.000001 and 1000000) then return false; end if;
  for entry in select value from jsonb_array_elements(data->'markers') loop
   if jsonb_typeof(entry->'id') is distinct from 'string' or jsonb_typeof(entry->'title') is distinct from 'string' or jsonb_typeof(entry->'x') is distinct from 'number' or jsonb_typeof(entry->'y') is distinct from 'number' or coalesce(btrim(entry->>'id'),'')='' or coalesce(btrim(entry->>'title'),'')='' or entry->>'id'=any(seen) or not ((entry->>'x')::numeric between 0 and 100 and (entry->>'y')::numeric between 0 and 100) then return false; end if;
   if entry ? 'href' and (jsonb_typeof(entry->'href') is distinct from 'string' or not public.safe_game_content_url(entry->>'href')) then return false; end if;
   if entry ? 'category' and (jsonb_typeof(entry->'category') is distinct from 'string' or coalesce(btrim(entry->>'category'),'')='') then return false; end if;
   if entry ? 'description' and jsonb_typeof(entry->'description') is distinct from 'string' then return false; end if;
   seen:=array_append(seen,entry->>'id');
  end loop;
 elsif kind='quiz' then
  foreach level_name in array array['easy','medium','hard'] loop
   if jsonb_typeof(data->level_name) is distinct from 'array' or jsonb_array_length(data->level_name)<1 or jsonb_array_length(data->level_name)>1000 then return false; end if;
   for question in select value from jsonb_array_elements(data->level_name) loop
    if jsonb_typeof(question->'id') is distinct from 'string' or jsonb_typeof(question->'question') is distinct from 'string' or coalesce(question->>'id','')='' or question->>'id' ~ '^[[:space:]]|[[:space:]]$' or question->>'id'=any(seen) or coalesce(btrim(question->>'question'),'')='' or jsonb_typeof(question->'options') is distinct from 'array' or jsonb_array_length(question->'options')<>4 then return false; end if;
    if question ? 'image' and jsonb_typeof(question->'image')<>'null' and (jsonb_typeof(question->'image') is distinct from 'string' or not public.safe_game_content_url(question->>'image')) then return false; end if;
    seen:=array_append(seen,question->>'id'); option_ids:='{}';
    for option_data in select value from jsonb_array_elements(question->'options') loop
     if jsonb_typeof(option_data->'id') is distinct from 'string' or jsonb_typeof(option_data->'text') is distinct from 'string' or coalesce(option_data->>'id','')='' or option_data->>'id' ~ '^[[:space:]]|[[:space:]]$' or coalesce(btrim(option_data->>'text'),'')='' or option_data->>'id'=any(option_ids) then return false; end if;
     option_ids:=array_append(option_ids,option_data->>'id');
    end loop;
    if jsonb_typeof(question->'correctOptionId') is distinct from 'string' or not coalesce(question->>'correctOptionId'=any(option_ids),false) then return false; end if;
   end loop;
  end loop;
 elsif kind='catalog' then
  if jsonb_typeof(data->'columns') is distinct from 'array' or jsonb_array_length(data->'columns')<1 or jsonb_array_length(data->'columns')>30 or jsonb_typeof(data->'items') is distinct from 'array' or jsonb_array_length(data->'items')<1 or jsonb_array_length(data->'items')>10000 then return false; end if;
  for entry in select value from jsonb_array_elements(data->'columns') loop
   if jsonb_typeof(entry->'key') is distinct from 'string' or jsonb_typeof(entry->'label') is distinct from 'string' or entry->>'key'='id' or coalesce(entry->>'key','')!~ '^[a-z][a-z0-9_]*$' or coalesce(btrim(entry->>'label'),'')='' or entry->>'key'=any(columns_keys) then return false; end if;
   columns_keys:=array_append(columns_keys,entry->>'key');
  end loop;
  for entry in select value from jsonb_array_elements(data->'items') loop
   if jsonb_typeof(entry) is distinct from 'object' or jsonb_typeof(entry->'id') is distinct from 'string' or coalesce(btrim(entry->>'id'),'')='' or entry->>'id'=any(seen) or exists(select 1 from jsonb_each(entry) fields where fields.key<>'id' and (not fields.key=any(columns_keys) or jsonb_typeof(fields.value) not in ('string','number','boolean','null') or (jsonb_typeof(fields.value)='number' and abs((fields.value::text)::numeric)>1.7976931348623157e308))) then return false; end if;
   seen:=array_append(seen,entry->>'id');
  end loop;
 else return false;
 end if;
 return true;
exception when others then return false;
end $$;
