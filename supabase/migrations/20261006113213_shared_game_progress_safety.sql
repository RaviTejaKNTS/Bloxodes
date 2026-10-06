create or replace function public.prepare_game_content() returns trigger language plpgsql set search_path='' as $$
declare g public.games%rowtype; root public.games%rowtype; wiki public.game_wiki_pages%rowtype; base text;
begin
 if tg_table_name='games' then
  if new.kind='game' and new.parent_id is null then select id into new.parent_id from public.games where namespace=new.namespace and kind='franchise'; end if;
  if new.parent_id is not null and not exists(select 1 from public.games where id=new.parent_id and kind='franchise' and namespace=new.namespace) then raise exception 'Game parent must be its franchise'; end if;
  return new;
 end if;
 if tg_table_name='game_collection_pages' then
  select * into strict wiki from public.game_wiki_pages where id=new.wiki_page_id;
  if new.game_id<>wiki.game_id or new.namespace<>wiki.namespace or new.wiki_slug<>wiki.slug then raise exception 'Collection wiki ownership mismatch'; end if;
  if new.canonical_path is null then new.canonical_path:=wiki.canonical_path||'/'||new.collection_slug; end if;
 else
  select * into strict g from public.games where id=new.game_id;
  if new.namespace<>g.namespace then raise exception 'Page game ownership mismatch'; end if;
  select * into root from public.games where id=coalesce(g.parent_id,g.id);
  base:='/'||root.slug;
  if new.canonical_path is null then
   if tg_table_name='game_wiki_pages' then new.canonical_path:=base||'/wiki'||case when g.parent_id is null then '' else '/'||g.slug end;
   elsif tg_table_name='game_code_pages' then new.canonical_path:=base||'/codes'||case when g.parent_id is null then '' else '/'||g.slug end;
   elsif tg_table_name='game_tool_pages' then new.canonical_path:=base||'/tools/'||new.slug;
   else new.canonical_path:=base||'/checklists/'||new.slug; end if;
  end if;
 end if;
 if new.canonical_path not like '/'||new.namespace||'/%' then raise exception 'Page route must belong to its namespace'; end if;
 if new.canonical_path !~ '^/[a-z0-9/-]+$' or new.canonical_path like '%..%' then raise exception 'Invalid game content path'; end if;
 if tg_table_name='game_checklist_pages' then
  if new.is_public and new.published_at is null then new.published_at:=now(); end if;
 else
  if new.is_published and new.published_at is null then new.published_at:=now(); end if;
 end if;
 return new;
end $$;

-- Conflict updates merge history while holding the progress row lock.
create function public.save_game_quiz_progress(
 target_user uuid, target_page uuid, target_namespace text,
 question_ids text[], score integer, total integer, breakdown jsonb
) returns void language plpgsql security invoker set search_path='' as $$
begin
 if not exists(select 1 from public.game_quiz_pages_view where id=target_page and namespace=target_namespace) then raise exception 'Unknown published quiz'; end if;
 insert into public.game_quiz_progress(user_id,quiz_page_id,namespace,seen_question_ids,last_score,last_total,last_breakdown,last_attempt_at)
 values(target_user,target_page,target_namespace,question_ids,score,total,breakdown,now())
 on conflict(user_id,quiz_page_id) do update set
  seen_question_ids=ARRAY(select distinct item from unnest(public.game_quiz_progress.seen_question_ids || excluded.seen_question_ids) item order by item),
  last_score=excluded.last_score,last_total=excluded.last_total,last_breakdown=excluded.last_breakdown,last_attempt_at=excluded.last_attempt_at,updated_at=now();
end $$;
revoke all on function public.save_game_quiz_progress(uuid,uuid,text,text[],integer,integer,jsonb) from public,anon,authenticated;
grant execute on function public.save_game_quiz_progress(uuid,uuid,text,text[],integer,integer,jsonb) to service_role;
