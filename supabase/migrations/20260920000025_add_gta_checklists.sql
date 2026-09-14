-- Created with the CLI, sequenced after the existing GTA/Red Dead platform migrations.
begin;
create table public.gta_checklist_pages (
  id uuid primary key default gen_random_uuid(),
  game_id uuid not null,
  slug text not null unique,
  title text not null check (length(btrim(title)) > 0),
  seo_title text,
  seo_description text,
  description_md text,
  is_public boolean not null default false,
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(game_id),
  foreign key (game_id, slug) references public.gta_games(id, slug) on delete cascade,
  check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$')
);
create table public.gta_checklist_items (
  id uuid primary key default gen_random_uuid(),
  page_id uuid not null references public.gta_checklist_pages(id) on delete cascade,
  item_key text not null,
  section_code text not null check (section_code ~ '^[1-9][0-9]*(\.[0-9]+){0,2}$'),
  title text not null check (length(btrim(title)) > 0),
  description text,
  is_required boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(page_id, item_key),
  unique(page_id, section_code)
);
alter table public.gta_checklist_pages enable row level security;
alter table public.gta_checklist_items enable row level security;
revoke all on public.gta_checklist_pages, public.gta_checklist_items from anon, authenticated;
grant select on public.gta_checklist_pages, public.gta_checklist_items to anon, authenticated;
grant all on public.gta_checklist_pages, public.gta_checklist_items to service_role;
create policy gta_checklist_pages_read on public.gta_checklist_pages for select to anon, authenticated
using (is_public and published_at <= now() and exists (select 1 from public.gta_games g where g.id = game_id and g.is_published));
create policy gta_checklist_items_read on public.gta_checklist_items for select to anon, authenticated
using (exists (select 1 from public.gta_checklist_pages p where p.id = page_id and p.is_public and p.published_at <= now()));
create trigger gta_checklist_pages_updated before update on public.gta_checklist_pages for each row execute function public.set_updated_at();
create trigger gta_checklist_items_updated before update on public.gta_checklist_items for each row execute function public.set_updated_at();
create view public.gta_checklist_pages_view with (security_invoker = true) as
select p.*, g.title as game_title, g.slug as game_slug, g.hero_image as image,
  (select count(*) from public.gta_checklist_items i where i.page_id=p.id and cardinality(string_to_array(i.section_code,'.'))=3) as leaf_item_count,
  greatest(p.updated_at, (select max(i.updated_at) from public.gta_checklist_items i where i.page_id=p.id)) as content_updated_at
from public.gta_checklist_pages p join public.gta_games g on g.id=p.game_id
where p.is_public and p.published_at <= now() and g.is_published;
grant select on public.gta_checklist_pages_view to anon, authenticated, service_role;

alter table public.revalidation_events drop constraint revalidation_events_entity_type_check;
alter table public.revalidation_events add constraint revalidation_events_entity_type_check check (entity_type in (
'code','article','author','event','checklist','tool','catalog','music','quiz','wiki','wiki_collection','stats','puzzle',
'gta_game','gta_wiki','gta_wiki_collection','gta_checklist','red_dead_game','red_dead_wiki','red_dead_wiki_collection'));

create function public.trg_gta_checklist_page_changed() returns trigger language plpgsql set search_path = pg_catalog, public as $$
begin
  if tg_op='DELETE' then
    delete from public.search_index where entity_type='gta_checklist' and entity_id=old.id::text;
    if old.is_public then perform public.enqueue_revalidation('gta_checklist',old.slug,'gta_checklist_delete'); end if;
    return null;
  end if;
  perform public.upsert_search_index('gta_checklist',new.id::text,new.slug,new.title,'GTA checklist','/gta/checklists/'||new.slug,new.updated_at,
    new.is_public and new.published_at <= now() and exists(select 1 from public.gta_games where id=new.game_id and is_published),
    left(concat_ws(' ',new.title,new.slug,new.seo_description,new.description_md),4000));
  if new.is_public or (tg_op='UPDATE' and old.is_public) then
    perform public.enqueue_revalidation('gta_checklist',new.slug,'gta_checklist_change');
  end if;
  return null;
end; $$;
create trigger gta_checklist_page_changed after insert or update or delete on public.gta_checklist_pages for each row execute function public.trg_gta_checklist_page_changed();
create function public.trg_gta_checklist_items_changed() returns trigger language plpgsql set search_path = pg_catalog, public as $$
begin
  update public.gta_checklist_pages set updated_at=now() where id=case when tg_op='DELETE' then old.page_id else new.page_id end;
  if tg_op='UPDATE' and old.page_id is distinct from new.page_id then
    update public.gta_checklist_pages set updated_at=now() where id=old.page_id;
  end if;
  return null;
end; $$;
create trigger gta_checklist_items_changed after insert or update or delete on public.gta_checklist_items for each row execute function public.trg_gta_checklist_items_changed();
create function public.trg_gta_checklist_game_changed() returns trigger language plpgsql set search_path = pg_catalog, public as $$
begin
  update public.gta_checklist_pages set updated_at=now() where game_id=new.id;
  return null;
end; $$;
create trigger gta_checklist_game_changed after update of is_published, title, hero_image on public.gta_games for each row execute function public.trg_gta_checklist_game_changed();
revoke all on function public.trg_gta_checklist_page_changed(), public.trg_gta_checklist_items_changed(), public.trg_gta_checklist_game_changed() from public;
grant execute on function public.trg_gta_checklist_page_changed(), public.trg_gta_checklist_items_changed(), public.trg_gta_checklist_game_changed() to service_role;
commit;
