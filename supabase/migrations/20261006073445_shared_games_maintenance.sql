begin;
create trigger game_games_touch before update on public.games for each row execute function public.game_content_touch();
create trigger game_wiki_touch before update on public.game_wiki_pages for each row execute function public.game_content_touch();
create trigger game_collection_touch before update on public.game_collection_pages for each row execute function public.game_content_touch();
create trigger game_tools_touch before update on public.game_tool_pages for each row execute function public.game_content_touch();
create trigger game_checklists_touch before update on public.game_checklist_pages for each row execute function public.game_content_touch();
create trigger game_checklist_items_touch before update on public.game_checklist_items for each row execute function public.game_content_touch();
create trigger game_progress_touch before update on public.game_collection_progress for each row execute function public.game_content_touch();
create or replace function public.protect_game_page_owner() returns trigger language plpgsql set search_path='' as $$
begin
 if new.id<>old.id or new.namespace<>old.namespace or new.game_id<>old.game_id then raise exception 'Page ownership is permanent; use a reviewed content migration'; end if;
 return new;
end $$;
create function public.protect_game_code_identity() returns trigger language plpgsql set search_path='' as $$
begin
 if new.id<>old.id or new.code_page_id<>old.code_page_id or new.code<>old.code or new.first_seen_at<>old.first_seen_at then raise exception 'Code identity and first-seen date are permanent'; end if;
 new.last_seen_at:=greatest(new.last_seen_at,old.last_seen_at);
 return new;
end $$;
create trigger protect_game_code_identity before update on public.game_codes for each row execute function public.protect_game_code_identity();
create or replace function public.trg_game_codes_changed() returns trigger language plpgsql set search_path='' as $$
declare owner_id uuid;
begin
 owner_id:=case when tg_op='DELETE' then old.code_page_id else new.code_page_id end;
 update public.game_code_pages set updated_at=now() where id=owner_id;
 return null;
end $$;
commit;
