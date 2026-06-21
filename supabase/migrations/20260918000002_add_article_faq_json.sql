alter table if exists public.articles
  add column if not exists faq_json jsonb not null default '[]'::jsonb;

drop view if exists public.article_pages_view;

create or replace view public.article_pages_view
with (security_invoker = true) as
select
  art.id,
  art.title,
  art.slug,
  art.content_md,
  art.cover_image,
  art.author_id,
  art.is_published,
  art.published_at,
  art.created_at,
  art.updated_at,
  art.word_count,
  art.meta_description,
  art.universe_id,
  art.tags,
  art.sources,
  art.faq_json,
  case when a.id is null then null else jsonb_build_object(
    'id', a.id,
    'name', a.name,
    'slug', a.slug,
    'gravatar_email', a.gravatar_email,
    'avatar_url', a.avatar_url,
    'bio_md', a.bio_md,
    'twitter', a.twitter,
    'youtube', a.youtube,
    'website', a.website,
    'facebook', a.facebook,
    'linkedin', a.linkedin,
    'instagram', a.instagram,
    'roblox', a.roblox,
    'discord', a.discord,
    'created_at', a.created_at,
    'updated_at', a.updated_at
  ) end as author,
  case when u.universe_id is null then null else jsonb_build_object(
    'universe_id', u.universe_id,
    'slug', u.slug,
    'display_name', u.display_name,
    'name', u.name,
    'icon_url', u.icon_url,
    'genre_l1', u.genre_l1,
    'genre_l2', u.genre_l2
  ) end as universe,
  (
    select coalesce(
      jsonb_agg(rec order by rec.published_at desc),
      '[]'::jsonb
    )
    from (
      select
        a2.id,
        a2.title,
        a2.slug,
        a2.cover_image,
        a2.published_at,
        a2.updated_at,
        case when a3.id is null then null else jsonb_build_object(
          'id', a3.id,
          'name', a3.name,
          'slug', a3.slug,
          'avatar_url', a3.avatar_url,
          'gravatar_email', a3.gravatar_email
        ) end as author
      from public.articles a2
      left join public.authors a3 on a3.id = a2.author_id
      where a2.is_published = true
        and a2.id <> art.id
      order by a2.published_at desc nulls last
      limit 6
    ) rec
  ) as related_articles
from public.articles art
left join public.authors a on a.id = art.author_id
left join public.roblox_universes u on u.universe_id = art.universe_id;
