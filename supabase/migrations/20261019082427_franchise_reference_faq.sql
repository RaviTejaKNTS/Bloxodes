begin;

-- Add the FAQ slot used by the Roblox reference templates without changing existing rows.
alter table public.game_map_pages add column faq_json jsonb not null default '[]'::jsonb
  check (jsonb_typeof(faq_json) = 'array');
alter table public.game_catalog_pages add column faq_json jsonb not null default '[]'::jsonb
  check (jsonb_typeof(faq_json) = 'array');

-- Append new view fields after the existing columns. Old readers and service-only grants survive.
create or replace view public.game_map_pages_view with (security_invoker = true) as
select p.id, p.namespace, p.game_id, p.slug, p.title, p.seo_title, p.meta_description,
  p.intro_md, p.description_md, p.sources_json, p.renderer_key, p.map_data,
  p.canonical_path, p.is_published, p.published_at, p.created_at, p.updated_at,
  g.title game_title, g.slug game_slug, p.faq_json
from public.game_map_pages p join public.games g on g.id = p.game_id
where p.is_published and g.is_published and (p.published_at is null or p.published_at <= now())
  and not exists (select 1 from public.games parent where parent.id = g.parent_id and not parent.is_published);

create or replace view public.game_catalog_pages_view with (security_invoker = true) as
select p.id, p.namespace, p.game_id, p.slug, p.title, p.seo_title, p.meta_description,
  p.intro_md, p.description_md, p.sources_json, p.catalog_data,
  p.canonical_path, p.is_published, p.published_at, p.created_at, p.updated_at,
  g.title game_title, g.slug game_slug, p.faq_json
from public.game_catalog_pages p join public.games g on g.id = p.game_id
where p.is_published and g.is_published and (p.published_at is null or p.published_at <= now())
  and not exists (select 1 from public.games parent where parent.id = g.parent_id and not parent.is_published);

commit;
