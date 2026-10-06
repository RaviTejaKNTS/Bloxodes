begin;
do $$ begin if exists(select 1 from public.game_tool_pages where code is distinct from slug) then raise exception 'Existing tool code/slug mismatch'; end if; end $$;
create function public.derive_game_tool_code() returns trigger language plpgsql set search_path='' as $$
begin
 if new.code is not null and new.code<>'' and new.code<>new.slug then raise exception 'Tool code must match its slug'; end if;
 new.code:=new.slug;
 return new;
end $$;
create trigger aa_derive_game_tool_code before insert or update on public.game_tool_pages for each row execute function public.derive_game_tool_code();
alter table public.game_tool_pages alter column code set default '';
alter table public.game_tool_pages alter column code set not null;
alter table public.game_tool_pages add constraint game_tool_code_slug_check check(code=slug);
notify pgrst, 'reload schema';
commit;
