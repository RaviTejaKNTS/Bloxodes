-- Revalidate game wiki hubs when universe-backed data shown on the wiki changes.

create or replace function public.enqueue_wiki_revalidation_for_universe(
  p_universe_id bigint,
  p_source text
)
returns void
language plpgsql
as $$
begin
  if p_universe_id is null then
    return;
  end if;

  insert into public.revalidation_events (entity_type, slug, source)
  select distinct 'wiki', lower(w.slug), p_source
  from public.wiki_pages w
  where w.universe_id = p_universe_id
    and w.is_published = true
    and w.slug is not null
    and trim(w.slug) <> ''
  on conflict (entity_type, slug)
  do update set
    created_at = now(),
    source = excluded.source;
end;
$$;

create or replace function public.trg_enqueue_revalidation_wiki_universe()
returns trigger
language plpgsql
as $$
declare
  target_universe_id bigint;
begin
  if tg_op = 'DELETE' then
    target_universe_id := old.universe_id;
    perform public.enqueue_wiki_revalidation_for_universe(target_universe_id, tg_table_name || '_' || lower(tg_op));
  elsif tg_op = 'UPDATE' then
    target_universe_id := new.universe_id;
    perform public.enqueue_wiki_revalidation_for_universe(target_universe_id, tg_table_name || '_' || lower(tg_op));

    if old.universe_id is distinct from new.universe_id then
      perform public.enqueue_wiki_revalidation_for_universe(old.universe_id, tg_table_name || '_old_universe_update');
    end if;
  else
    target_universe_id := new.universe_id;
    perform public.enqueue_wiki_revalidation_for_universe(target_universe_id, tg_table_name || '_' || lower(tg_op));
  end if;

  return null;
end;
$$;

drop trigger if exists trg_enqueue_revalidation_wiki_roblox_universes on public.roblox_universes;
create trigger trg_enqueue_revalidation_wiki_roblox_universes
after insert or update or delete on public.roblox_universes
for each row execute function public.trg_enqueue_revalidation_wiki_universe();

drop trigger if exists trg_enqueue_revalidation_wiki_universe_social_links on public.roblox_universe_social_links;
create trigger trg_enqueue_revalidation_wiki_universe_social_links
after insert or update or delete on public.roblox_universe_social_links
for each row execute function public.trg_enqueue_revalidation_wiki_universe();

drop trigger if exists trg_enqueue_revalidation_wiki_universe_media on public.roblox_universe_media;
create trigger trg_enqueue_revalidation_wiki_universe_media
after insert or update or delete on public.roblox_universe_media
for each row execute function public.trg_enqueue_revalidation_wiki_universe();

drop trigger if exists trg_enqueue_revalidation_wiki_universe_badges on public.roblox_universe_badges;
create trigger trg_enqueue_revalidation_wiki_universe_badges
after insert or update or delete on public.roblox_universe_badges
for each row execute function public.trg_enqueue_revalidation_wiki_universe();

drop trigger if exists trg_enqueue_revalidation_wiki_universe_gamepasses on public.roblox_universe_gamepasses;
create trigger trg_enqueue_revalidation_wiki_universe_gamepasses
after insert or update or delete on public.roblox_universe_gamepasses
for each row execute function public.trg_enqueue_revalidation_wiki_universe();

drop trigger if exists trg_enqueue_revalidation_wiki_universe_place_servers on public.roblox_universe_place_servers;
create trigger trg_enqueue_revalidation_wiki_universe_place_servers
after insert or update or delete on public.roblox_universe_place_servers
for each row execute function public.trg_enqueue_revalidation_wiki_universe();
