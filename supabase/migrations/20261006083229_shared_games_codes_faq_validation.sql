begin;
create function public.valid_game_codes_faq(value jsonb) returns boolean language sql immutable set search_path='' as $$
 select value is null or case when jsonb_typeof(value)='array' then not exists(select 1 from jsonb_array_elements(value) entry where jsonb_typeof(entry)<>'object' or jsonb_typeof(entry->'q') is distinct from 'string' or jsonb_typeof(entry->'a') is distinct from 'string' or trim(entry->>'q')='' or trim(entry->>'a')='') else false end;
$$;
alter table public.game_code_pages add constraint game_codes_faq_shape_check check(public.valid_game_codes_faq(faq_json));
commit;
