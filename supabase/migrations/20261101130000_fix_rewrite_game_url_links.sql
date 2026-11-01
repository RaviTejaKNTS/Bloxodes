begin;

-- 20261101120000 left the mapping columns unqualified, and they clash with the
-- function's own `value` parameter. Qualify them; signature and grants unchanged.
create or replace function public.rewrite_game_url_links(value jsonb, mapping jsonb, collection_paths jsonb default '[]'::jsonb) returns jsonb
language plpgsql immutable set search_path='' as $$
declare result jsonb; pair record; entry record; original text; revised text;
begin
 case jsonb_typeof(value)
 when 'object' then
  select coalesce(jsonb_object_agg(key,public.rewrite_game_url_links(v,mapping,collection_paths)),'{}'::jsonb) into result from jsonb_each(value) e(key,v);
 when 'array' then
  select coalesce(jsonb_agg(public.rewrite_game_url_links(v,mapping,collection_paths) order by n),'[]'::jsonb) into result from jsonb_array_elements(value) with ordinality e(v,n);
 when 'string' then
  original:=value#>>'{}'; revised:=original;
  for pair in select m.key,m.value#>>'{}' target from jsonb_each(mapping) m order by length(m.key) desc,m.key loop
   revised:=regexp_replace(revised,'(^|[[:space:]"''(<])(https://bloxodes\.com)?'||pair.key||case when collection_paths ? pair.key then '(/page/[1-9][0-9]*)?' else '()' end||'(?=$|[#?[:space:]"'')<>])', E'\\1\\2'||pair.target||E'\\3','g');
  end loop;
  result:=to_jsonb(revised);
 else result:=value;
 end case;
 return result;
end $$;

commit;
