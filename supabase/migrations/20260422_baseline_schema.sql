--
-- PostgreSQL database dump
--

-- Dumped from database version 17.6
-- Dumped by pg_dump version 18.3

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET transaction_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: extensions; Type: SCHEMA; Schema: -; Owner: -
--

CREATE SCHEMA IF NOT EXISTS "extensions";

--
-- Name: pg_trgm; Type: EXTENSION; Schema: -; Owner: -
--

CREATE EXTENSION IF NOT EXISTS "pg_trgm" WITH SCHEMA "extensions";

--
-- Name: uuid-ossp; Type: EXTENSION; Schema: -; Owner: -
--

CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA "extensions";



--
-- Name: article_generation_queue_idempotency_key("text", bigint); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION "public"."article_generation_queue_idempotency_key"("title" "text", "universe_id" bigint) RETURNS "text"
    LANGUAGE "sql" IMMUTABLE
    AS $$
  select case
    when nullif(trim(both '-' from regexp_replace(lower(coalesce(title, '')), '[^a-z0-9]+', '-', 'g')), '') is null
      then null
    else coalesce(universe_id::text, 'global') || ':' ||
      trim(both '-' from regexp_replace(lower(coalesce(title, '')), '[^a-z0-9]+', '-', 'g'))
  end;
$$;


--
-- Name: article_generation_queue; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE "public"."article_generation_queue" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "article_title" "text",
    "article_type" "text",
    "status" "text" DEFAULT 'pending'::"text" NOT NULL,
    "attempts" integer DEFAULT 0 NOT NULL,
    "last_attempted_at" timestamp with time zone,
    "last_error" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "sources" "text",
    "universe_id" bigint,
    "event_id" "text",
    "locked_at" timestamp with time zone,
    "locked_by" "text",
    "next_attempt_at" timestamp with time zone,
    "completed_at" timestamp with time zone,
    "article_id" "uuid",
    "idempotency_key" "text",
    CONSTRAINT "article_generation_queue_article_type_check" CHECK (("article_type" = ANY (ARRAY['listicle'::"text", 'how_to'::"text", 'explainer'::"text", 'opinion'::"text", 'news'::"text"]))),
    CONSTRAINT "article_generation_queue_status_check" CHECK (("status" = ANY (ARRAY['pending'::"text", 'processing'::"text", 'completed'::"text", 'failed'::"text"])))
);


--
-- Name: claim_article_generation_queue_item("uuid", "text", integer); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION "public"."claim_article_generation_queue_item"("p_queue_id" "uuid" DEFAULT NULL::"uuid", "p_worker_id" "text" DEFAULT NULL::"text", "p_max_attempts" integer DEFAULT 3) RETURNS "public"."article_generation_queue"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  claimed public.article_generation_queue;
  effective_max_attempts integer := greatest(coalesce(p_max_attempts, 3), 1);
begin
  update public.article_generation_queue q
  set
    status = 'failed',
    last_error = 'Duplicate completed article generation queue item for topic/universe.',
    next_attempt_at = null,
    locked_at = null,
    locked_by = null
  where q.status = 'pending'
    and (p_queue_id is null or q.id = p_queue_id)
    and q.event_id is null
    and q.idempotency_key is not null
    and exists (
      select 1
      from public.article_generation_queue completed
      where completed.idempotency_key = q.idempotency_key
        and completed.id <> q.id
        and completed.status = 'completed'
    );

  update public.article_generation_queue
  set
    status = 'failed',
    last_error = 'Queue item exceeded max attempts after a stale processing lock.',
    next_attempt_at = null,
    locked_at = null,
    locked_by = null
  where status = 'processing'
    and locked_at is not null
    and locked_at < now() - interval '30 minutes'
    and attempts >= effective_max_attempts;

  update public.article_generation_queue
  set
    status = 'pending',
    next_attempt_at = now(),
    locked_at = null,
    locked_by = null
  where status = 'processing'
    and locked_at is not null
    and locked_at < now() - interval '30 minutes'
    and attempts < effective_max_attempts;

  update public.article_generation_queue q
  set
    status = 'processing',
    attempts = coalesce(q.attempts, 0) + 1,
    last_attempted_at = now(),
    last_error = null,
    locked_at = now(),
    locked_by = coalesce(nullif(p_worker_id, ''), 'article-generator'),
    next_attempt_at = null
  where q.id = (
    select candidate.id
    from public.article_generation_queue candidate
    where candidate.status = 'pending'
      and (p_queue_id is null or candidate.id = p_queue_id)
      and coalesce(candidate.attempts, 0) < effective_max_attempts
      and (candidate.next_attempt_at is null or candidate.next_attempt_at <= now())
      and (candidate.event_id is null or candidate.event_id = '')
      and not exists (
        select 1
        from public.article_generation_queue active
        where active.idempotency_key = candidate.idempotency_key
          and active.id <> candidate.id
          and active.status = 'processing'
      )
    order by candidate.created_at asc, candidate.id asc
    for update skip locked
    limit 1
  )
  returning * into claimed;

  return claimed;
end;
$$;


--
-- Name: enqueue_revalidation("text", "text", "text"); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION "public"."enqueue_revalidation"("p_entity_type" "text", "p_slug" "text", "p_source" "text" DEFAULT NULL::"text") RETURNS "void"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'pg_catalog', 'public'
    AS $$
begin
  if p_slug is null or trim(p_slug) = '' then
    return;
  end if;

  insert into public.revalidation_events (entity_type, slug, source)
  values (lower(p_entity_type), lower(trim(p_slug)), p_source)
  on conflict on constraint revalidation_events_entity_slug_key
  do update set
    created_at = now(),
    source = excluded.source;
end;
$$;


--
-- Name: get_items_needing_metrics_calculation(integer, integer); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION "public"."get_items_needing_metrics_calculation"("p_limit" integer DEFAULT 100, "p_max_age_hours" integer DEFAULT 1) RETURNS TABLE("asset_id" bigint, "name" "text", "rap" bigint, "last_calculated" timestamp with time zone, "hours_since_calculation" numeric)
    LANGUAGE "plpgsql" STABLE
    SET "search_path" TO 'pg_catalog', 'public'
    AS $$
begin
  return query
  select
    ci.asset_id,
    ci.name,
    ci.rap,
    ci.trading_metrics_calculated_at,
    case
      when ci.trading_metrics_calculated_at is null then null
      else extract(epoch from (now() - ci.trading_metrics_calculated_at)) / 3600
    end as hours_since_calculation
  from public.roblox_catalog_items ci
  where (ci.is_limited = true or ci.is_limited_unique = true)
    and ci.rap is not null
    and (
      ci.trading_metrics_calculated_at is null
      or ci.trading_metrics_calculated_at < now() - (p_max_age_hours || ' hours')::interval
    )
  order by
    ci.trading_metrics_calculated_at asc nulls first,
    ci.rap desc nulls last
  limit p_limit;
end;
$$;


--
-- Name: get_items_needing_rap_update(integer, integer); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION "public"."get_items_needing_rap_update"("p_limit" integer DEFAULT 100, "p_max_age_hours" integer DEFAULT 12) RETURNS TABLE("asset_id" bigint, "name" "text", "last_fetched" timestamp with time zone, "hours_since_update" numeric)
    LANGUAGE "plpgsql" STABLE
    SET "search_path" TO 'pg_catalog', 'public'
    AS $$
begin
  return query
  select
    ci.asset_id,
    ci.name,
    ci.rap_last_fetched,
    case
      when ci.rap_last_fetched is null then null
      else extract(epoch from (now() - ci.rap_last_fetched)) / 3600
    end as hours_since_update
  from public.roblox_catalog_items ci
  where (ci.is_limited = true or ci.is_limited_unique = true)
    and (
      ci.rap_last_fetched is null
      or ci.rap_last_fetched < now() - (p_max_age_hours || ' hours')::interval
    )
  order by
    ci.rap_last_fetched asc nulls first,
    ci.rap desc nulls last
  limit p_limit;
end;
$$;


--
-- Name: is_admin("uuid"); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION "public"."is_admin"("user_uuid" "uuid") RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'pg_catalog', 'public'
    AS $$
  select exists (
    select 1
    from public.app_users au
    where au.user_id = user_uuid
      and au.role = 'admin'
  );
$$;


--
-- Name: normalize_section_code("text"); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION "public"."normalize_section_code"("raw" "text") RETURNS "text"
    LANGUAGE "plpgsql" IMMUTABLE
    SET "search_path" TO 'pg_catalog', 'public'
    AS $_$
declare
  cleaned text;
begin
  cleaned := regexp_replace(coalesce(raw, ''), E'[\\s\\u00A0]', '', 'g');
  cleaned := regexp_replace(cleaned, '[^0-9\\.]', '', 'g');
  cleaned := regexp_replace(cleaned, '\\.{2,}', '.', 'g');
  cleaned := regexp_replace(cleaned, '^\\.|\\.$', '', 'g');
  return cleaned;
end;
$_$;


--
-- Name: qualifies_for_free_items_catalog(bigint, boolean, "jsonb", boolean, bigint, "text", "text", "text", bigint); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION "public"."qualifies_for_free_items_catalog"("p_price_robux" bigint, "p_is_deleted" boolean, "p_raw_economy_json" "jsonb", "p_has_resellers" boolean, "p_lowest_resale_price_robux" bigint, "p_name" "text", "p_category" "text", "p_subcategory" "text", "p_favorite_count" bigint) RETURNS boolean
    LANGUAGE "sql" IMMUTABLE
    AS $$
  select coalesce(
    p_price_robux = 0
    and p_is_deleted = false
    and coalesce(p_raw_economy_json ->> 'free_item_source', '') = 'robloxden'
    and p_has_resellers = false
    and p_lowest_resale_price_robux = 0
    and p_name is not null
    and p_category is not null
    and p_subcategory is not null
    and p_favorite_count is not null,
    false
  );
$$;


--
-- Name: refresh_search_index_music(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION "public"."refresh_search_index_music"() RETURNS "void"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'pg_catalog', 'public'
    AS $$
begin
  delete from public.search_index
  where entity_type in ('music_hub', 'music_genre', 'music_artist');

  insert into public.search_index (
    entity_type,
    entity_id,
    slug,
    title,
    subtitle,
    url,
    updated_at,
    is_published,
    search_text
  )
  values
    ('music_hub', 'roblox-music-ids', 'roblox-music-ids', 'Roblox Music IDs', 'Music IDs', '/catalog/roblox-music-ids', now(), true, 'roblox music ids songs audio'),
    ('music_hub', 'roblox-music-ids-trending', 'roblox-music-ids-trending', 'Trending Roblox Music IDs', 'Music IDs', '/catalog/roblox-music-ids/trending', now(), true, 'trending roblox music ids'),
    ('music_hub', 'roblox-music-ids-genres', 'roblox-music-ids-genres', 'Roblox Music Genres', 'Music IDs', '/catalog/roblox-music-ids/genres', now(), true, 'roblox music ids genres'),
    ('music_hub', 'roblox-music-ids-artists', 'roblox-music-ids-artists', 'Roblox Music Artists', 'Music IDs', '/catalog/roblox-music-ids/artists', now(), true, 'roblox music ids artists');
end;
$$;


--
-- Name: run_game_list_sql("text", integer); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION "public"."run_game_list_sql"("sql_text" "text", "limit_count" integer DEFAULT NULL::integer) RETURNS TABLE("universe_id" bigint, "rank" integer, "metric_value" numeric, "reason" "text", "extra" "jsonb", "game_id" "uuid", "playing" bigint, "visits" bigint, "favorites" bigint, "likes" bigint, "dislikes" bigint)
    LANGUAGE "plpgsql"
    SET "search_path" TO 'pg_catalog', 'public'
    AS $$
declare
  trimmed text;
  capped_limit int;
begin
  if sql_text is null or length(trim(sql_text)) = 0 then
    raise exception 'sql_text is required';
  end if;

  trimmed := ltrim(sql_text);
  if lower(left(trimmed, 6)) <> 'select' then
    raise exception 'sql_text must start with SELECT';
  end if;

  capped_limit := nullif(limit_count, 0);

  return query execute format(
    'select * from (%s) as src(universe_id, rank, metric_value, reason, extra, game_id, playing, visits, favorites, likes, dislikes) %s',
    sql_text,
    case
      when capped_limit is null then ''
      else format('limit %s', capped_limit)
    end
  );
end;
$$;


--
-- Name: search_site("text", integer, integer); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION "public"."search_site"("p_query" "text", "p_limit" integer DEFAULT 120, "p_offset" integer DEFAULT 0) RETURNS TABLE("entity_type" "text", "entity_id" "text", "slug" "text", "title" "text", "subtitle" "text", "url" "text", "updated_at" timestamp with time zone, "active_code_count" bigint)
    LANGUAGE "plpgsql" STABLE
    SET "search_path" TO 'pg_catalog', 'public'
    AS $$
declare
  v_query text := trim(coalesce(p_query, ''));
  v_limit integer := greatest(1, least(coalesce(p_limit, 120), 200));
  v_offset integer := greatest(0, coalesce(p_offset, 0));
begin
  if v_query = '' then
    return;
  end if;

  return query
  with q as (
    select websearch_to_tsquery('english', v_query) as tsq
  )
  select
    si.entity_type,
    si.entity_id,
    si.slug,
    si.title,
    si.subtitle,
    si.url,
    coalesce(g.content_updated_at, si.updated_at) as updated_at,
    case when si.entity_type = 'code' then g.active_code_count else null end as active_code_count
  from public.search_index si
  cross join q
  left join public.game_pages_index_view g
    on si.entity_type = 'code'
    and g.id::text = si.entity_id
  where si.is_published = true
    and (
      si.search_vector @@ q.tsq
      or si.search_text ilike '%' || v_query || '%'
    )
  order by
    greatest(
      ts_rank_cd(si.search_vector, q.tsq),
      extensions.similarity(si.search_text, v_query)
    ) desc,
    updated_at desc nulls last
  limit v_limit
  offset v_offset;
end;
$$;


--
-- Name: set_article_generation_queue_idempotency_key(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION "public"."set_article_generation_queue_idempotency_key"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public'
    AS $$
begin
  new.idempotency_key := public.article_generation_queue_idempotency_key(new.article_title, new.universe_id);
  return new;
end;
$$;


--
-- Name: set_article_published_at(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION "public"."set_article_published_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'pg_catalog', 'public'
    AS $$
begin
  if NEW.is_published = true
     and (OLD.is_published is distinct from true)
     and NEW.published_at is null then
    NEW.published_at := now();
  end if;
  return NEW;
end;
$$;


--
-- Name: set_catalog_page_published_at(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION "public"."set_catalog_page_published_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'pg_catalog', 'public'
    AS $$
begin
  if new.is_published = true
     and (old.is_published is distinct from true)
     and new.published_at is null then
    new.published_at := now();
  end if;
  return new;
end;
$$;


--
-- Name: set_checklist_published_at(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION "public"."set_checklist_published_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'pg_catalog', 'public'
    AS $$
begin
  if new.is_public = true
     and (old.is_public is distinct from true)
     and new.published_at is null then
    new.published_at := now();
  end if;
  return new;
end;
$$;


--
-- Name: set_game_published_at(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION "public"."set_game_published_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'pg_catalog', 'public'
    AS $$
begin
  if NEW.is_published = true
     and (OLD.is_published is distinct from true)
     and NEW.published_at is null then
    NEW.published_at := now();
  end if;
  return NEW;
end;
$$;


--
-- Name: set_quiz_page_published_at(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION "public"."set_quiz_page_published_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'pg_catalog', 'public'
    AS $$
begin
  if new.is_published = true
     and (old.is_published is distinct from true)
     and new.published_at is null then
    new.published_at := now();
  end if;
  return new;
end;
$$;


--
-- Name: set_tool_published_at(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION "public"."set_tool_published_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'pg_catalog', 'public'
    AS $$
begin
  if new.is_published = true
     and (old.is_published is distinct from true)
     and new.published_at is null then
    new.published_at := now();
  end if;
  return new;
end;
$$;


--
-- Name: set_updated_at(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION "public"."set_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'pg_catalog', 'public'
    AS $$
begin
  new.updated_at = now();
  return new;
end;
$$;


--
-- Name: set_wiki_page_published_at(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION "public"."set_wiki_page_published_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
begin
  if new.is_published = true and new.published_at is null then
    if tg_op = 'INSERT' then
      new.published_at := now();
    elsif old.is_published is distinct from true then
      new.published_at := now();
    end if;
  end if;
  return new;
end;
$$;


--
-- Name: trg_comments_revalidate_code(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION "public"."trg_comments_revalidate_code"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'pg_catalog', 'public'
    AS $$
begin
  if new.entity_type = 'code' and new.status = 'approved' and (tg_op = 'INSERT' or old.status is distinct from new.status) then
    insert into public.revalidation_events (entity_type, slug, source)
    select 'code', g.slug, 'comment'
    from public.games g
    where g.id = new.entity_id
    on conflict (entity_type, slug)
    do update set
      source = excluded.source,
      created_at = now();
  end if;
  return new;
end;
$$;


--
-- Name: trg_enqueue_revalidation_articles(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION "public"."trg_enqueue_revalidation_articles"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'pg_catalog', 'public'
    AS $$
begin
  if tg_op = 'DELETE' then
    perform public.enqueue_revalidation('article', old.slug, 'articles_delete');
  elsif new.is_published = true then
    perform public.enqueue_revalidation('article', new.slug, 'articles_' || lower(tg_op));
  elsif tg_op = 'UPDATE' and old.is_published = true then
    perform public.enqueue_revalidation('article', old.slug, 'articles_unpublish');
  end if;
  return null;
end;
$$;


--
-- Name: trg_enqueue_revalidation_authors(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION "public"."trg_enqueue_revalidation_authors"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'pg_catalog', 'public'
    AS $$
declare
  author_id uuid;
  author_slug text;
begin
  author_id := coalesce(new.id, old.id);
  author_slug := coalesce(new.slug, old.slug);

  if author_slug is not null and trim(author_slug) <> '' then
    perform public.enqueue_revalidation('author', author_slug, 'authors_' || lower(tg_op));
  end if;

  -- Revalidate articles authored by this author
  insert into public.revalidation_events (entity_type, slug, source)
  select distinct 'article', lower(a.slug), 'authors_articles_' || lower(tg_op)
  from public.articles a
  where a.author_id = author_id
    and a.slug is not null
    and trim(a.slug) <> ''
  on conflict on constraint revalidation_events_entity_slug_key
  do update set
    created_at = now(),
    source = excluded.source;

  -- Revalidate code pages for games attributed to this author
  insert into public.revalidation_events (entity_type, slug, source)
  select distinct 'code', lower(g.slug), 'authors_games_' || lower(tg_op)
  from public.games g
  where g.author_id = author_id
    and g.is_published = true
    and g.slug is not null
    and trim(g.slug) <> ''
  on conflict on constraint revalidation_events_entity_slug_key
  do update set
    created_at = now(),
    source = excluded.source;

  return null;
end;
$$;


--
-- Name: trg_enqueue_revalidation_catalog_pages(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION "public"."trg_enqueue_revalidation_catalog_pages"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'pg_catalog', 'public'
    AS $$
begin
  if tg_op = 'DELETE' then
    perform public.enqueue_revalidation('catalog', old.code, 'catalog_pages_delete');
  elsif new.is_published = true then
    perform public.enqueue_revalidation('catalog', new.code, 'catalog_pages_' || lower(tg_op));
  elsif tg_op = 'UPDATE' and old.is_published = true then
    perform public.enqueue_revalidation('catalog', old.code, 'catalog_pages_unpublish');
  end if;
  return null;
end;
$$;


--
-- Name: trg_enqueue_revalidation_checklist_items(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION "public"."trg_enqueue_revalidation_checklist_items"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'pg_catalog', 'public'
    AS $$
declare
  page_slug text;
begin
  if tg_op = 'DELETE' then
    select slug into page_slug from public.checklist_pages where id = old.page_id;
  else
    select slug into page_slug from public.checklist_pages where id = new.page_id;
  end if;

  if page_slug is not null and trim(page_slug) <> '' then
    perform public.enqueue_revalidation('checklist', page_slug, 'checklist_items_' || lower(tg_op));
  end if;
  return null;
end;
$$;


--
-- Name: trg_enqueue_revalidation_checklist_pages(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION "public"."trg_enqueue_revalidation_checklist_pages"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'pg_catalog', 'public'
    AS $$
begin
  if tg_op = 'DELETE' then
    perform public.enqueue_revalidation('checklist', old.slug, 'checklist_pages_delete');
  elsif new.is_public = true then
    perform public.enqueue_revalidation('checklist', new.slug, 'checklist_pages_' || lower(tg_op));
  elsif tg_op = 'UPDATE' and old.is_public = true then
    perform public.enqueue_revalidation('checklist', old.slug, 'checklist_pages_unpublish');
  end if;
  return null;
end;
$$;


--
-- Name: trg_enqueue_revalidation_codes(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION "public"."trg_enqueue_revalidation_codes"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'pg_catalog', 'public'
    AS $$
declare
  game_slug text;
begin
  if tg_op = 'DELETE' then
    select slug into game_slug from public.games where id = old.game_id;
  else
    select slug into game_slug from public.games where id = new.game_id;
  end if;

  if game_slug is not null then
    perform public.enqueue_revalidation('code', game_slug, 'codes_' || lower(tg_op));
  end if;
  return null;
end;
$$;


--
-- Name: trg_enqueue_revalidation_events_pages(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION "public"."trg_enqueue_revalidation_events_pages"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'pg_catalog', 'public'
    AS $$
begin
  if tg_op = 'DELETE' then
    perform public.enqueue_revalidation('event', old.slug, 'events_pages_delete');
  elsif new.is_published = true then
    perform public.enqueue_revalidation('event', new.slug, 'events_pages_' || lower(tg_op));
  elsif tg_op = 'UPDATE' and old.is_published = true then
    perform public.enqueue_revalidation('event', old.slug, 'events_pages_unpublish');
  end if;
  return null;
end;
$$;


--
-- Name: trg_enqueue_revalidation_free_item_images(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION "public"."trg_enqueue_revalidation_free_item_images"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
declare
  target_asset_id bigint;
  should_revalidate boolean := false;
begin
  target_asset_id := coalesce(new.asset_id, old.asset_id);
  if target_asset_id is null then
    return null;
  end if;

  select public.qualifies_for_free_items_catalog(
    item.price_robux,
    item.is_deleted,
    item.raw_economy_json,
    item.has_resellers,
    item.lowest_resale_price_robux,
    item.name,
    item.category,
    item.subcategory,
    item.favorite_count
  )
  into should_revalidate
  from public.roblox_catalog_items item
  where item.asset_id = target_asset_id;

  should_revalidate := coalesce(should_revalidate, false);

  if should_revalidate then
    perform public.enqueue_revalidation('catalog', 'roblox-free-items', 'roblox_catalog_item_images_' || lower(tg_op));
  end if;

  return null;
end;
$$;


--
-- Name: trg_enqueue_revalidation_free_items_catalog(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION "public"."trg_enqueue_revalidation_free_items_catalog"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
declare
  old_qualifies boolean := false;
  new_qualifies boolean := false;
begin
  if tg_op <> 'INSERT' then
    old_qualifies := public.qualifies_for_free_items_catalog(
      old.price_robux,
      old.is_deleted,
      old.raw_economy_json,
      old.has_resellers,
      old.lowest_resale_price_robux,
      old.name,
      old.category,
      old.subcategory,
      old.favorite_count
    );
  end if;

  if tg_op <> 'DELETE' then
    new_qualifies := public.qualifies_for_free_items_catalog(
      new.price_robux,
      new.is_deleted,
      new.raw_economy_json,
      new.has_resellers,
      new.lowest_resale_price_robux,
      new.name,
      new.category,
      new.subcategory,
      new.favorite_count
    );
  end if;

  if old_qualifies or new_qualifies then
    perform public.enqueue_revalidation('catalog', 'roblox-free-items', 'roblox_catalog_items_' || lower(tg_op));
  end if;

  return null;
end;
$$;


--
-- Name: trg_enqueue_revalidation_game_list_entries(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION "public"."trg_enqueue_revalidation_game_list_entries"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'pg_catalog', 'public'
    AS $$
declare
  list_slug text;
begin
  if tg_op = 'DELETE' then
    select slug into list_slug from public.game_lists where id = old.list_id;
  else
    select slug into list_slug from public.game_lists where id = new.list_id;
  end if;

  if list_slug is not null then
    perform public.enqueue_revalidation('list', list_slug, 'game_list_entries_' || lower(tg_op));
  end if;
  return null;
end;
$$;


--
-- Name: trg_enqueue_revalidation_game_lists(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION "public"."trg_enqueue_revalidation_game_lists"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'pg_catalog', 'public'
    AS $$
begin
  if tg_op = 'DELETE' then
    perform public.enqueue_revalidation('list', old.slug, 'game_lists_delete');
  elsif new.is_published = true then
    perform public.enqueue_revalidation('list', new.slug, 'game_lists_' || lower(tg_op));
  elsif tg_op = 'UPDATE' and old.is_published = true then
    perform public.enqueue_revalidation('list', old.slug, 'game_lists_unpublish');
  end if;
  return null;
end;
$$;


--
-- Name: trg_enqueue_revalidation_games(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION "public"."trg_enqueue_revalidation_games"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'pg_catalog', 'public'
    AS $$
begin
  if tg_op = 'DELETE' then
    perform public.enqueue_revalidation('code', old.slug, 'games_delete');
  elsif new.is_published = true then
    perform public.enqueue_revalidation('code', new.slug, 'games_' || lower(tg_op));
  elsif tg_op = 'UPDATE' and old.is_published = true then
    perform public.enqueue_revalidation('code', old.slug, 'games_unpublish');
  end if;
  return null;
end;
$$;


--
-- Name: trg_enqueue_revalidation_music_ids(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION "public"."trg_enqueue_revalidation_music_ids"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'pg_catalog', 'public'
    AS $$
begin
  perform public.enqueue_revalidation('music', 'roblox-music-ids', 'roblox_music_ids_' || lower(tg_op));
  return null;
end;
$$;


--
-- Name: trg_enqueue_revalidation_quiz_pages(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION "public"."trg_enqueue_revalidation_quiz_pages"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'pg_catalog', 'public'
    AS $$
begin
  if tg_op = 'DELETE' then
    perform public.enqueue_revalidation('quiz', old.code, 'quiz_pages_delete');
  elsif new.is_published = true then
    perform public.enqueue_revalidation('quiz', new.code, 'quiz_pages_' || lower(tg_op));
  elsif tg_op = 'UPDATE' and old.is_published = true then
    perform public.enqueue_revalidation('quiz', old.code, 'quiz_pages_unpublish');
  end if;
  return null;
end;
$$;


--
-- Name: trg_enqueue_revalidation_tools(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION "public"."trg_enqueue_revalidation_tools"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'pg_catalog', 'public'
    AS $$
begin
  if tg_op = 'DELETE' then
    perform public.enqueue_revalidation('tool', old.code, 'tools_delete');
  elsif new.is_published = true then
    perform public.enqueue_revalidation('tool', new.code, 'tools_' || lower(tg_op));
  elsif tg_op = 'UPDATE' and old.is_published = true then
    perform public.enqueue_revalidation('tool', old.code, 'tools_unpublish');
  end if;
  return null;
end;
$$;


--
-- Name: trg_enqueue_revalidation_virtual_event_assets(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION "public"."trg_enqueue_revalidation_virtual_event_assets"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'pg_catalog', 'public'
    AS $$
declare
  target_event_id text;
  target_universe_id bigint;
  page_slug text;
begin
  target_event_id := coalesce(new.event_id, old.event_id);
  if target_event_id is null then
    return null;
  end if;

  select universe_id into target_universe_id
  from public.roblox_virtual_events
  where event_id = target_event_id;

  if target_universe_id is null then
    return null;
  end if;

  select slug into page_slug
  from public.events_pages
  where universe_id = target_universe_id
    and is_published = true;

  if page_slug is not null and trim(page_slug) <> '' then
    perform public.enqueue_revalidation('event', page_slug, 'roblox_virtual_event_assets_' || lower(tg_op));
  end if;
  return null;
end;
$$;


--
-- Name: trg_enqueue_revalidation_virtual_events(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION "public"."trg_enqueue_revalidation_virtual_events"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'pg_catalog', 'public'
    AS $$
declare
  target_universe_id bigint;
  page_slug text;
begin
  target_universe_id := coalesce(new.universe_id, old.universe_id);
  if target_universe_id is null then
    return null;
  end if;

  select slug into page_slug
  from public.events_pages
  where universe_id = target_universe_id
    and is_published = true;

  if page_slug is not null and trim(page_slug) <> '' then
    perform public.enqueue_revalidation('event', page_slug, 'roblox_virtual_events_' || lower(tg_op));
  end if;
  return null;
end;
$$;


--
-- Name: trg_enqueue_revalidation_wiki_pages(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION "public"."trg_enqueue_revalidation_wiki_pages"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
begin
  if tg_op = 'DELETE' then
    perform public.enqueue_revalidation('wiki', old.slug, 'wiki_pages_delete');
  elsif new.is_published = true then
    perform public.enqueue_revalidation('wiki', new.slug, 'wiki_pages_' || lower(tg_op));
  elsif tg_op = 'UPDATE' and old.is_published = true then
    perform public.enqueue_revalidation('wiki', old.slug, 'wiki_pages_unpublish');
  end if;
  return null;
end;
$$;


--
-- Name: trg_normalize_section_code(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION "public"."trg_normalize_section_code"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'pg_catalog', 'public'
    AS $$
begin
  new.section_code := public.normalize_section_code(new.section_code);
  return new;
end;
$$;


--
-- Name: trg_refresh_search_index_music(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION "public"."trg_refresh_search_index_music"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'pg_catalog', 'public'
    AS $$
begin
  perform public.refresh_search_index_music();
  return null;
end;
$$;


--
-- Name: trg_search_index_articles(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION "public"."trg_search_index_articles"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'pg_catalog', 'public'
    AS $$
declare
  v_search text;
begin
  if (tg_op = 'DELETE') then
    delete from public.search_index
    where entity_type = 'article'
      and entity_id = old.id::text;
    return null;
  end if;

  v_search := left(
    concat_ws(
      ' ',
      new.title,
      new.slug,
      new.meta_description,
      new.content_md
    ),
    4000
  );

  perform public.upsert_search_index(
    'article',
    new.id::text,
    new.slug,
    new.title,
    'Article',
    '/articles/' || new.slug,
    new.updated_at,
    new.is_published,
    v_search
  );

  return null;
end;
$$;


--
-- Name: trg_search_index_authors(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION "public"."trg_search_index_authors"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'pg_catalog', 'public'
    AS $$
declare
  v_search text;
begin
  if (tg_op = 'DELETE') then
    delete from public.search_index
    where entity_type = 'author'
      and entity_id = old.id::text;
    return null;
  end if;

  v_search := left(
    concat_ws(
      ' ',
      new.name,
      new.slug,
      new.bio_md
    ),
    2000
  );

  perform public.upsert_search_index(
    'author',
    new.id::text,
    new.slug,
    new.name,
    'Author',
    '/authors/' || new.slug,
    new.updated_at,
    true,
    v_search
  );

  return null;
end;
$$;


--
-- Name: trg_search_index_catalog_pages(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION "public"."trg_search_index_catalog_pages"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'pg_catalog', 'public'
    AS $$
declare
  v_search text;
begin
  if (tg_op = 'DELETE') then
    delete from public.search_index
    where entity_type = 'catalog'
      and entity_id = old.id::text;
    return null;
  end if;

  v_search := left(
    concat_ws(
      ' ',
      new.title,
      new.code,
      new.seo_title,
      new.meta_description,
      new.intro_md,
      new.how_it_works_md
    ),
    3000
  );

  perform public.upsert_search_index(
    'catalog',
    new.id::text,
    new.code,
    new.title,
    'Catalog',
    '/catalog/' || new.code,
    new.updated_at,
    new.is_published,
    v_search
  );

  return null;
end;
$$;


--
-- Name: trg_search_index_checklists(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION "public"."trg_search_index_checklists"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'pg_catalog', 'public'
    AS $$
declare
  v_search text;
begin
  if (tg_op = 'DELETE') then
    delete from public.search_index
    where entity_type = 'checklist'
      and entity_id = old.id::text;
    return null;
  end if;

  v_search := left(
    concat_ws(
      ' ',
      new.title,
      new.slug,
      new.description_md,
      new.seo_description
    ),
    3000
  );

  perform public.upsert_search_index(
    'checklist',
    new.id::text,
    new.slug,
    new.title,
    'Checklist',
    '/checklists/' || new.slug,
    new.updated_at,
    new.is_public,
    v_search
  );

  return null;
end;
$$;


--
-- Name: trg_search_index_events_pages(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION "public"."trg_search_index_events_pages"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'pg_catalog', 'public'
    AS $$
declare
  v_search text;
begin
  if (tg_op = 'DELETE') then
    delete from public.search_index
    where entity_type = 'event'
      and entity_id = old.id::text;
    return null;
  end if;

  if new.slug is null or trim(new.slug) = '' then
    return null;
  end if;

  v_search := left(
    concat_ws(
      ' ',
      new.title,
      new.slug,
      new.meta_description,
      new.content_md
    ),
    3000
  );

  perform public.upsert_search_index(
    'event',
    new.id::text,
    new.slug,
    new.title,
    'Event',
    '/events/' || new.slug,
    new.updated_at,
    new.is_published,
    v_search
  );

  return null;
end;
$$;


--
-- Name: trg_search_index_game_lists(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION "public"."trg_search_index_game_lists"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'pg_catalog', 'public'
    AS $$
declare
  v_title text;
  v_search text;
begin
  if (tg_op = 'DELETE') then
    delete from public.search_index
    where entity_type = 'list'
      and entity_id = old.id::text;
    return null;
  end if;

  v_title := coalesce(new.display_name, new.title);
  v_search := left(
    concat_ws(
      ' ',
      v_title,
      new.title,
      new.slug,
      new.meta_title,
      new.meta_description,
      new.hero_md,
      new.intro_md,
      new.outro_md
    ),
    3000
  );

  perform public.upsert_search_index(
    'list',
    new.id::text,
    new.slug,
    v_title,
    'List',
    '/lists/' || new.slug,
    new.updated_at,
    new.is_published,
    v_search
  );

  return null;
end;
$$;


--
-- Name: trg_search_index_games(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION "public"."trg_search_index_games"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'pg_catalog', 'public'
    AS $$
declare
  v_search text;
begin
  if (tg_op = 'DELETE') then
    delete from public.search_index
    where entity_type = 'code'
      and entity_id = old.id::text;
    return null;
  end if;

  v_search := left(
    concat_ws(
      ' ',
      new.name,
      new.slug,
      array_to_string(new.old_slugs, ' '),
      new.seo_title,
      new.seo_description,
      new.intro_md,
      new.description_md,
      new.find_codes_md,
      new.about_game_md
    ),
    4000
  );

  perform public.upsert_search_index(
    'code',
    new.id::text,
    new.slug,
    new.name,
    'Codes',
    '/codes/' || new.slug,
    new.updated_at,
    new.is_published,
    v_search
  );

  return null;
end;
$$;


--
-- Name: trg_search_index_quiz_pages(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION "public"."trg_search_index_quiz_pages"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'pg_catalog', 'public'
    AS $$
declare
  v_search text;
begin
  if (tg_op = 'DELETE') then
    delete from public.search_index
    where entity_type = 'quiz'
      and entity_id = old.id::text;
    return null;
  end if;

  v_search := left(
    concat_ws(
      ' ',
      new.title,
      new.code,
      new.seo_title,
      new.seo_description,
      new.description_md,
      new.about_md
    ),
    3000
  );

  perform public.upsert_search_index(
    'quiz',
    new.id::text,
    new.code,
    new.title,
    'Quiz',
    '/quizzes/' || new.code,
    new.updated_at,
    new.is_published,
    v_search
  );

  return null;
end;
$$;


--
-- Name: trg_search_index_tools(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION "public"."trg_search_index_tools"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'pg_catalog', 'public'
    AS $$
declare
  v_search text;
begin
  if (tg_op = 'DELETE') then
    delete from public.search_index
    where entity_type = 'tool'
      and entity_id = old.id::text;
    return null;
  end if;

  v_search := left(
    concat_ws(
      ' ',
      new.title,
      new.code,
      new.seo_title,
      new.meta_description,
      new.intro_md,
      new.how_it_works_md
    ),
    3000
  );

  perform public.upsert_search_index(
    'tool',
    new.id::text,
    new.code,
    new.title,
    'Tool',
    '/tools/' || new.code,
    new.updated_at,
    new.is_published,
    v_search
  );

  return null;
end;
$$;


--
-- Name: trg_search_index_wiki_pages(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION "public"."trg_search_index_wiki_pages"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
declare
  v_search text;
begin
  if (tg_op = 'DELETE') then
    delete from public.search_index
    where entity_type = 'wiki'
      and entity_id = old.id::text;
    return null;
  end if;

  v_search := left(
    concat_ws(
      ' ',
      new.title,
      new.slug,
      new.seo_title,
      new.meta_description,
      new.tips_md
    ),
    3000
  );

  perform public.upsert_search_index(
    'wiki',
    new.id::text,
    new.slug,
    new.title,
    'Wiki',
    '/wiki/' || new.slug,
    new.updated_at,
    new.is_published,
    v_search
  );

  return null;
end;
$$;


--
-- Name: upsert_code("uuid", "text", "text", "text", integer, boolean); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION "public"."upsert_code"("p_game_id" "uuid", "p_code" "text", "p_status" "text", "p_rewards_text" "text", "p_level_requirement" integer, "p_is_new" boolean) RETURNS "void"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'pg_catalog', 'public'
    AS $$
begin
  insert into public.codes (game_id, code, status, rewards_text, level_requirement, is_new)
  values (p_game_id, p_code, p_status, p_rewards_text, p_level_requirement, p_is_new)
  on conflict (game_id, code) do update
    set status = excluded.status,
        rewards_text = excluded.rewards_text,
        level_requirement = excluded.level_requirement,
        is_new = excluded.is_new,
        last_seen_at = now();
end;
$$;


--
-- Name: upsert_code("uuid", "text", "text", "text", integer, boolean, integer); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION "public"."upsert_code"("p_game_id" "uuid", "p_code" "text", "p_status" "text", "p_rewards_text" "text", "p_level_requirement" integer, "p_is_new" boolean, "p_provider_priority" integer DEFAULT 0) RETURNS "void"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'pg_catalog', 'public'
    AS $$
declare
  v_code text;
  v_existing_id uuid;
begin
  v_code := nullif(btrim(p_code), '');
  if v_code is null then
    return;
  end if;

  select id
  into v_existing_id
  from public.codes
  where game_id = p_game_id
    and upper(code) = upper(v_code)
  limit 1;

  if v_existing_id is null then
    begin
      insert into public.codes (game_id, code, status, rewards_text, level_requirement, is_new, provider_priority)
      values (p_game_id, v_code, p_status, p_rewards_text, p_level_requirement, p_is_new, p_provider_priority)
      on conflict (game_id, code) do update
        set status = excluded.status,
            rewards_text = excluded.rewards_text,
            level_requirement = excluded.level_requirement,
            is_new = excluded.is_new,
            provider_priority = excluded.provider_priority,
            last_seen_at = now(),
            code = excluded.code;
    exception
      when unique_violation then
        update public.codes
        set code = v_code,
            status = p_status,
            rewards_text = p_rewards_text,
            level_requirement = p_level_requirement,
            is_new = p_is_new,
            provider_priority = p_provider_priority,
            last_seen_at = now()
        where game_id = p_game_id
          and upper(code) = upper(v_code);
    end;
  else
    update public.codes
    set code = v_code,
        status = p_status,
        rewards_text = p_rewards_text,
        level_requirement = p_level_requirement,
        is_new = p_is_new,
        provider_priority = p_provider_priority,
        last_seen_at = now()
    where id = v_existing_id;
  end if;
end;
$$;


--
-- Name: upsert_search_index("text", "text", "text", "text", "text", "text", timestamp with time zone, boolean, "text"); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION "public"."upsert_search_index"("p_entity_type" "text", "p_entity_id" "text", "p_slug" "text", "p_title" "text", "p_subtitle" "text", "p_url" "text", "p_updated_at" timestamp with time zone, "p_is_published" boolean, "p_search_text" "text") RETURNS "void"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'pg_catalog', 'public'
    AS $$
begin
  if p_entity_id is null or trim(p_entity_id) = '' then
    return;
  end if;
  if p_slug is null or trim(p_slug) = '' then
    return;
  end if;
  if p_title is null or trim(p_title) = '' then
    return;
  end if;
  if p_url is null or trim(p_url) = '' then
    return;
  end if;

  insert into public.search_index (
    entity_type,
    entity_id,
    slug,
    title,
    subtitle,
    url,
    updated_at,
    is_published,
    search_text
  )
  values (
    lower(p_entity_type),
    p_entity_id,
    lower(trim(p_slug)),
    p_title,
    p_subtitle,
    p_url,
    p_updated_at,
    coalesce(p_is_published, false),
    coalesce(p_search_text, '')
  )
  on conflict (entity_type, entity_id)
  do update set
    slug = excluded.slug,
    title = excluded.title,
    subtitle = excluded.subtitle,
    url = excluded.url,
    updated_at = excluded.updated_at,
    is_published = excluded.is_published,
    search_text = excluded.search_text;
end;
$$;


--
-- Name: app_sessions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE "public"."app_sessions" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "user_agent" "text",
    "expires_at" timestamp with time zone NOT NULL,
    "revoked_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


--
-- Name: app_users; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE "public"."app_users" (
    "user_id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "role" "text" DEFAULT 'user'::"text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "display_name" "text",
    "preferences" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "roblox_user_id" bigint,
    "roblox_username" "text",
    "roblox_display_name" "text",
    "roblox_profile_url" "text",
    "roblox_avatar_url" "text",
    "roblox_linked_at" timestamp with time zone,
    CONSTRAINT "app_users_role_check" CHECK (("role" = ANY (ARRAY['admin'::"text", 'user'::"text"])))
);


--
-- Name: article_generation_artifacts; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE "public"."article_generation_artifacts" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "queue_id" "uuid",
    "article_id" "uuid",
    "prompt_version" "text" NOT NULL,
    "model" "text" NOT NULL,
    "topic" "text",
    "universe_id" bigint,
    "status" "text" NOT NULL,
    "error" "text",
    "sources" "jsonb" DEFAULT '[]'::"jsonb" NOT NULL,
    "extracted_facts" "jsonb" DEFAULT '[]'::"jsonb" NOT NULL,
    "coverage_checklist" "jsonb",
    "fact_check_feedback" "jsonb",
    "link_candidates" "jsonb" DEFAULT '[]'::"jsonb" NOT NULL,
    "token_usage" "jsonb" DEFAULT '[]'::"jsonb" NOT NULL,
    "validation_results" "jsonb" DEFAULT '[]'::"jsonb" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "article_generation_artifacts_status_check" CHECK (("status" = ANY (ARRAY['completed'::"text", 'failed'::"text"])))
);


--
-- Name: articles; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE "public"."articles" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "title" "text" NOT NULL,
    "slug" "text" NOT NULL,
    "content_md" "text" NOT NULL,
    "cover_image" "text",
    "author_id" "uuid",
    "is_published" boolean DEFAULT false NOT NULL,
    "published_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "word_count" integer,
    "meta_description" "text",
    "universe_id" bigint,
    "tags" "text"[] DEFAULT '{}'::"text"[] NOT NULL,
    "sources" "text"[] DEFAULT '{}'::"text"[] NOT NULL
);


--
-- Name: authors; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE "public"."authors" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "name" "text" NOT NULL,
    "slug" "text" NOT NULL,
    "gravatar_email" "text",
    "avatar_url" "text",
    "bio_md" "text",
    "twitter" "text",
    "youtube" "text",
    "website" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "facebook" "text",
    "linkedin" "text",
    "instagram" "text",
    "roblox" "text",
    "discord" "text"
);


--
-- Name: roblox_universes; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE "public"."roblox_universes" (
    "universe_id" bigint NOT NULL,
    "root_place_id" bigint NOT NULL,
    "name" "text" NOT NULL,
    "display_name" "text",
    "slug" "text",
    "description" "text",
    "description_source" "text",
    "creator_id" bigint,
    "creator_name" "text",
    "creator_type" "text",
    "creator_has_verified_badge" boolean,
    "group_id" bigint,
    "group_name" "text",
    "group_has_verified_badge" boolean,
    "visibility" "text",
    "privacy_type" "text",
    "is_active" boolean,
    "is_archived" boolean,
    "is_sponsored" boolean,
    "genre" "text",
    "genre_l1" "text",
    "genre_l2" "text",
    "is_all_genre" boolean,
    "age_rating" "text",
    "universe_avatar_type" "text",
    "desktop_enabled" boolean,
    "mobile_enabled" boolean,
    "tablet_enabled" boolean,
    "console_enabled" boolean,
    "vr_enabled" boolean,
    "voice_chat_enabled" boolean,
    "price" integer,
    "private_server_price_robux" integer,
    "create_vip_servers_allowed" boolean,
    "studio_access_allowed" boolean,
    "max_players" integer,
    "server_size" integer,
    "playing" bigint,
    "visits" bigint,
    "favorites" bigint,
    "likes" bigint,
    "dislikes" bigint,
    "icon_url" "text",
    "thumbnail_urls" "jsonb" DEFAULT '[]'::"jsonb" NOT NULL,
    "social_links" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "raw_metadata" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "raw_details" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "first_seen_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "last_seen_in_sort" timestamp with time zone,
    "last_seen_in_search" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "game_description_md" "text",
    "created_at_api" timestamp with time zone,
    "updated_at_api" timestamp with time zone
);


--
-- Name: article_pages_index_view; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW "public"."article_pages_index_view" WITH ("security_invoker"='true') AS
 SELECT "art"."id",
    "art"."title",
    "art"."slug",
    "art"."cover_image",
    "art"."meta_description",
    "art"."published_at",
    "art"."created_at",
    "art"."updated_at",
    "art"."is_published",
    "art"."universe_id",
        CASE
            WHEN ("a"."id" IS NULL) THEN NULL::"jsonb"
            ELSE "jsonb_build_object"('id', "a"."id", 'name', "a"."name", 'slug', "a"."slug", 'avatar_url', "a"."avatar_url", 'gravatar_email', "a"."gravatar_email")
        END AS "author",
        CASE
            WHEN ("u"."universe_id" IS NULL) THEN NULL::"jsonb"
            ELSE "jsonb_build_object"('universe_id', "u"."universe_id", 'slug', "u"."slug", 'display_name', "u"."display_name", 'name', "u"."name", 'icon_url', "u"."icon_url")
        END AS "universe"
   FROM (("public"."articles" "art"
     LEFT JOIN "public"."authors" "a" ON (("a"."id" = "art"."author_id")))
     LEFT JOIN "public"."roblox_universes" "u" ON (("u"."universe_id" = "art"."universe_id")))
  WHERE ("art"."is_published" IS NOT NULL);


--
-- Name: article_pages_view; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW "public"."article_pages_view" WITH ("security_invoker"='true') AS
 SELECT "art"."id",
    "art"."title",
    "art"."slug",
    "art"."content_md",
    "art"."cover_image",
    "art"."author_id",
    "art"."is_published",
    "art"."published_at",
    "art"."created_at",
    "art"."updated_at",
    "art"."word_count",
    "art"."meta_description",
    "art"."universe_id",
    "art"."tags",
        CASE
            WHEN ("a"."id" IS NULL) THEN NULL::"jsonb"
            ELSE "jsonb_build_object"('id', "a"."id", 'name', "a"."name", 'slug', "a"."slug", 'gravatar_email', "a"."gravatar_email", 'avatar_url', "a"."avatar_url", 'bio_md', "a"."bio_md", 'twitter', "a"."twitter", 'youtube', "a"."youtube", 'website', "a"."website", 'facebook', "a"."facebook", 'linkedin', "a"."linkedin", 'instagram', "a"."instagram", 'roblox', "a"."roblox", 'discord', "a"."discord", 'created_at', "a"."created_at", 'updated_at', "a"."updated_at")
        END AS "author",
        CASE
            WHEN ("u"."universe_id" IS NULL) THEN NULL::"jsonb"
            ELSE "jsonb_build_object"('universe_id', "u"."universe_id", 'slug', "u"."slug", 'display_name', "u"."display_name", 'name', "u"."name", 'icon_url', "u"."icon_url", 'genre_l1', "u"."genre_l1", 'genre_l2', "u"."genre_l2")
        END AS "universe",
    ( SELECT COALESCE("jsonb_agg"("rec".* ORDER BY "rec"."published_at" DESC), '[]'::"jsonb") AS "coalesce"
           FROM ( SELECT "a2"."id",
                    "a2"."title",
                    "a2"."slug",
                    "a2"."cover_image",
                    "a2"."published_at",
                    "a2"."updated_at",
                        CASE
                            WHEN ("a3"."id" IS NULL) THEN NULL::"jsonb"
                            ELSE "jsonb_build_object"('id', "a3"."id", 'name', "a3"."name", 'slug', "a3"."slug", 'avatar_url', "a3"."avatar_url", 'gravatar_email', "a3"."gravatar_email")
                        END AS "author"
                   FROM ("public"."articles" "a2"
                     LEFT JOIN "public"."authors" "a3" ON (("a3"."id" = "a2"."author_id")))
                  WHERE (("a2"."is_published" = true) AND ("a2"."id" <> "art"."id"))
                  ORDER BY "a2"."published_at" DESC NULLS LAST
                 LIMIT 6) "rec") AS "related_articles"
   FROM (("public"."articles" "art"
     LEFT JOIN "public"."authors" "a" ON (("a"."id" = "art"."author_id")))
     LEFT JOIN "public"."roblox_universes" "u" ON (("u"."universe_id" = "art"."universe_id")));


--
-- Name: article_source_images; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE "public"."article_source_images" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "article_id" "uuid" NOT NULL,
    "source_url" "text" NOT NULL,
    "source_host" "text" NOT NULL,
    "name" "text" NOT NULL,
    "original_url" "text" NOT NULL,
    "uploaded_path" "text" NOT NULL,
    "alt_text" "text",
    "caption" "text",
    "context" "text",
    "is_table" boolean DEFAULT false NOT NULL,
    "width" integer,
    "height" integer,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "public_url" "text",
    "table_key" "text",
    "row_text" "text"
);


--
-- Name: catalog_pages; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE "public"."catalog_pages" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "code" "text" NOT NULL,
    "title" "text" NOT NULL,
    "seo_title" "text" NOT NULL,
    "meta_description" "text" NOT NULL,
    "intro_md" "text",
    "how_it_works_md" "text",
    "description_json" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "faq_json" "jsonb" DEFAULT '[]'::"jsonb" NOT NULL,
    "cta_label" "text",
    "cta_url" "text",
    "schema_ld_json" "jsonb",
    "thumb_url" "text",
    "is_published" boolean DEFAULT true NOT NULL,
    "published_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "universe_id" bigint,
    "wiki_md" "text",
    "wiki_sort_order" integer,
    "wiki_item_count" integer,
    "wiki_image_urls" "text"[] DEFAULT '{}'::"text"[] NOT NULL
);


--
-- Name: catalog_pages_view; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW "public"."catalog_pages_view" WITH ("security_invoker"='true') AS
 SELECT "id",
    "code",
    "title",
    "seo_title",
    "meta_description",
    "intro_md",
    "how_it_works_md",
    "description_json",
    "faq_json",
    "cta_label",
    "cta_url",
    "schema_ld_json",
    "thumb_url",
    "is_published",
    "published_at",
    "created_at",
    "updated_at",
    "universe_id",
    "wiki_md",
    "wiki_sort_order",
    "wiki_item_count",
    "wiki_image_urls",
    GREATEST("updated_at", COALESCE("published_at", "updated_at")) AS "content_updated_at"
   FROM "public"."catalog_pages" "cp";


--
-- Name: checklist_items; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE "public"."checklist_items" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "page_id" "uuid" NOT NULL,
    "section_code" "text" NOT NULL,
    "title" "text" NOT NULL,
    "description" "text",
    "is_required" boolean DEFAULT false NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


--
-- Name: checklist_pages; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE "public"."checklist_pages" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "universe_id" bigint NOT NULL,
    "slug" "text" NOT NULL,
    "title" "text" NOT NULL,
    "seo_title" "text",
    "seo_description" "text",
    "published_at" timestamp with time zone,
    "is_public" boolean DEFAULT true NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "description_md" "text"
);


--
-- Name: checklist_pages_view; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW "public"."checklist_pages_view" WITH ("security_invoker"='true') AS
 WITH "item_stats" AS (
         SELECT "checklist_items"."page_id",
            "count"(*) AS "item_count",
            "count"(*) FILTER (WHERE ("cardinality"("string_to_array"("checklist_items"."section_code", '.'::"text")) >= 3)) AS "leaf_item_count",
            "max"("checklist_items"."updated_at") AS "latest_item_at"
           FROM "public"."checklist_items"
          GROUP BY "checklist_items"."page_id"
        )
 SELECT "cp"."id",
    "cp"."universe_id",
    "cp"."slug",
    "cp"."title",
    "cp"."seo_title",
    "cp"."seo_description",
    "cp"."published_at",
    "cp"."is_public",
    "cp"."created_at",
    "cp"."updated_at",
    "cp"."description_md",
    COALESCE("stats"."item_count", (0)::bigint) AS "item_count",
    COALESCE("stats"."leaf_item_count", (0)::bigint) AS "leaf_item_count",
    COALESCE("stats"."latest_item_at", "cp"."updated_at") AS "content_updated_at",
        CASE
            WHEN ("u"."universe_id" IS NULL) THEN NULL::"jsonb"
            ELSE "jsonb_build_object"('universe_id', "u"."universe_id", 'slug', "u"."slug", 'display_name', "u"."display_name", 'name', "u"."name", 'icon_url', "u"."icon_url", 'thumbnail_urls', "u"."thumbnail_urls", 'genre_l1', "u"."genre_l1", 'genre_l2', "u"."genre_l2")
        END AS "universe"
   FROM (("public"."checklist_pages" "cp"
     LEFT JOIN "item_stats" "stats" ON (("stats"."page_id" = "cp"."id")))
     LEFT JOIN "public"."roblox_universes" "u" ON (("u"."universe_id" = "cp"."universe_id")));


--
-- Name: codes; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE "public"."codes" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "game_id" "uuid" NOT NULL,
    "code" "text" NOT NULL,
    "status" "text" NOT NULL,
    "rewards_text" "text",
    "level_requirement" integer,
    "is_new" boolean,
    "first_seen_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "last_seen_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "posted_online" boolean DEFAULT false NOT NULL,
    "provider_priority" integer DEFAULT 0 NOT NULL,
    CONSTRAINT "codes_status_check" CHECK (("status" = ANY (ARRAY['active'::"text", 'expired'::"text", 'check'::"text"])))
);


--
-- Name: games; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE "public"."games" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "name" "text" NOT NULL,
    "slug" "text" NOT NULL,
    "source_url" "text",
    "cover_image" "text",
    "seo_title" "text",
    "seo_description" "text",
    "description_md" "text",
    "is_published" boolean DEFAULT false NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "intro_md" "text",
    "redeem_md" "text",
    "author_id" "uuid",
    "expired_codes" "jsonb" DEFAULT '[]'::"jsonb" NOT NULL,
    "source_url_2" "text",
    "source_url_3" "text",
    "roblox_link" "text",
    "twitter_link" "text",
    "discord_link" "text",
    "community_link" "text",
    "youtube_link" "text",
    "internal_links" integer DEFAULT 0 NOT NULL,
    "universe_id" bigint,
    "rewards_md" "text",
    "troubleshoot_md" "text",
    "about_game_md" "text",
    "old_slugs" "text"[] DEFAULT '{}'::"text"[] NOT NULL,
    "re_rewritten_at" timestamp with time zone,
    "interlinking_ai" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "interlinking_ai_copy_md" "text",
    "published_at" timestamp with time zone,
    "find_codes_md" "text"
);


--
-- Name: code_pages_view; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW "public"."code_pages_view" WITH ("security_invoker"='true') AS
 WITH "code_stats" AS (
         SELECT "c"."game_id",
            "jsonb_agg"("c".* ORDER BY "c"."status", "c"."last_seen_at" DESC) FILTER (WHERE ("c"."id" IS NOT NULL)) AS "codes",
            "count"(*) FILTER (WHERE ("c"."status" = 'active'::"text")) AS "active_code_count",
            "max"("c"."first_seen_at") FILTER (WHERE ("c"."status" = 'active'::"text")) AS "latest_code_first_seen_at"
           FROM "public"."codes" "c"
          GROUP BY "c"."game_id"
        )
 SELECT "g"."id",
    "g"."name",
    "g"."slug",
    "g"."old_slugs",
    "g"."author_id",
    "g"."roblox_link",
    "g"."universe_id",
    "g"."community_link",
    "g"."discord_link",
    "g"."twitter_link",
    "g"."youtube_link",
    "g"."expired_codes",
    "g"."cover_image",
    "g"."seo_title",
    "g"."seo_description",
    "g"."intro_md",
    "g"."redeem_md",
    "g"."find_codes_md",
    "g"."troubleshoot_md",
    "g"."rewards_md",
    "g"."about_game_md",
    "g"."description_md",
    "g"."internal_links",
    "g"."is_published",
    "g"."re_rewritten_at",
    "g"."created_at",
    "g"."updated_at",
    "u"."genre_l1",
    "u"."genre_l2",
    COALESCE("cs"."codes", '[]'::"jsonb") AS "codes",
    COALESCE("cs"."active_code_count", (0)::bigint) AS "active_code_count",
    "cs"."latest_code_first_seen_at",
    GREATEST(COALESCE("cs"."latest_code_first_seen_at", "g"."updated_at"), "g"."updated_at") AS "content_updated_at",
        CASE
            WHEN ("a"."id" IS NULL) THEN NULL::"jsonb"
            ELSE "jsonb_build_object"('id', "a"."id", 'name', "a"."name", 'slug', "a"."slug", 'gravatar_email', "a"."gravatar_email", 'avatar_url', "a"."avatar_url", 'bio_md', "a"."bio_md", 'twitter', "a"."twitter", 'youtube', "a"."youtube", 'website', "a"."website", 'facebook', "a"."facebook", 'linkedin', "a"."linkedin", 'instagram', "a"."instagram", 'roblox', "a"."roblox", 'discord', "a"."discord", 'created_at', "a"."created_at", 'updated_at', "a"."updated_at")
        END AS "author",
        CASE
            WHEN ("u"."universe_id" IS NULL) THEN NULL::"jsonb"
            ELSE "jsonb_build_object"('universe_id', "u"."universe_id", 'slug', "u"."slug", 'display_name', "u"."display_name", 'name', "u"."name", 'creator_name', "u"."creator_name", 'creator_id', "u"."creator_id", 'creator_type', "u"."creator_type", 'social_links', "u"."social_links", 'icon_url', "u"."icon_url", 'genre_l1', "u"."genre_l1", 'genre_l2', "u"."genre_l2", 'playing', "u"."playing", 'visits', "u"."visits", 'favorites', "u"."favorites", 'likes', "u"."likes", 'dislikes', "u"."dislikes", 'age_rating', "u"."age_rating", 'desktop_enabled', "u"."desktop_enabled", 'mobile_enabled', "u"."mobile_enabled", 'tablet_enabled', "u"."tablet_enabled", 'console_enabled', "u"."console_enabled", 'vr_enabled', "u"."vr_enabled", 'updated_at', "u"."updated_at", 'description', "u"."description", 'game_description_md', "u"."game_description_md")
        END AS "universe",
    ( SELECT COALESCE("jsonb_agg"("rec".* ORDER BY "rec"."active_code_count" DESC, "rec"."updated_at" DESC), '[]'::"jsonb") AS "coalesce"
           FROM ( SELECT "g2"."id",
                    "g2"."name",
                    "g2"."slug",
                    "g2"."cover_image",
                    COALESCE("cs2"."active_code_count", (0)::bigint) AS "active_code_count",
                    GREATEST(COALESCE("cs2"."latest_code_first_seen_at", "g2"."updated_at"), "g2"."updated_at") AS "content_updated_at",
                    "g2"."updated_at",
                    "u2"."genre_l1",
                    "u2"."genre_l2"
                   FROM (("public"."games" "g2"
                     LEFT JOIN "code_stats" "cs2" ON (("cs2"."game_id" = "g2"."id")))
                     LEFT JOIN "public"."roblox_universes" "u2" ON (("u2"."universe_id" = "g2"."universe_id")))
                  WHERE (("g2"."is_published" = true) AND ("g2"."id" <> "g"."id"))
                  ORDER BY COALESCE("cs2"."active_code_count", (0)::bigint) DESC, "g2"."updated_at" DESC
                 LIMIT 6) "rec") AS "recommended_games",
    "g"."interlinking_ai_copy_md"
   FROM ((("public"."games" "g"
     LEFT JOIN "code_stats" "cs" ON (("cs"."game_id" = "g"."id")))
     LEFT JOIN "public"."authors" "a" ON (("a"."id" = "g"."author_id")))
     LEFT JOIN "public"."roblox_universes" "u" ON (("u"."universe_id" = "g"."universe_id")));


--
-- Name: comments; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE "public"."comments" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "entity_type" "text" NOT NULL,
    "entity_id" "uuid" NOT NULL,
    "parent_id" "uuid",
    "author_id" "uuid",
    "body_md" "text" NOT NULL,
    "status" "text" DEFAULT 'pending'::"text" NOT NULL,
    "moderation" "jsonb",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "guest_name" "text",
    "guest_email" "text",
    CONSTRAINT "comments_entity_type_check" CHECK (("entity_type" = ANY (ARRAY['code'::"text", 'article'::"text", 'catalog'::"text", 'event'::"text", 'list'::"text", 'tool'::"text"]))),
    CONSTRAINT "comments_status_check" CHECK (("status" = ANY (ARRAY['pending'::"text", 'approved'::"text", 'rejected'::"text", 'deleted'::"text"])))
);


--
-- Name: event_guide_generation_queue; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE "public"."event_guide_generation_queue" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "event_id" "text" NOT NULL,
    "universe_id" bigint,
    "guide_title" "text",
    "guide_slug" "text",
    "article_id" "uuid",
    "status" "text" DEFAULT 'pending'::"text" NOT NULL,
    "attempts" integer DEFAULT 0 NOT NULL,
    "last_attempted_at" timestamp with time zone,
    "last_error" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "event_guide_generation_queue_status_check" CHECK (("status" = ANY (ARRAY['pending'::"text", 'completed'::"text", 'failed'::"text"])))
);


--
-- Name: events_pages; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE "public"."events_pages" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "universe_id" bigint NOT NULL,
    "title" "text" NOT NULL,
    "content_md" "text",
    "seo_title" "text",
    "meta_description" "text",
    "is_published" boolean DEFAULT true NOT NULL,
    "published_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "slug" "text",
    "author_id" "uuid"
);


--
-- Name: game_code_stats; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW "public"."game_code_stats" WITH ("security_invoker"='true') AS
 SELECT "g"."id",
    "g"."name",
    "g"."slug",
    "g"."cover_image",
    "g"."created_at",
    "g"."updated_at",
    COALESCE("stats"."active_count", (0)::bigint) AS "active_count",
    "stats"."latest_code_first_seen_at",
        CASE
            WHEN (("stats"."latest_code_first_seen_at" IS NOT NULL) AND ("stats"."latest_code_first_seen_at" > "g"."updated_at")) THEN "stats"."latest_code_first_seen_at"
            ELSE "g"."updated_at"
        END AS "content_updated_at"
   FROM ("public"."games" "g"
     LEFT JOIN LATERAL ( SELECT "count"(*) FILTER (WHERE ("c"."status" = 'active'::"text")) AS "active_count",
            "max"("c"."first_seen_at") FILTER (WHERE ("c"."status" = 'active'::"text")) AS "latest_code_first_seen_at"
           FROM "public"."codes" "c"
          WHERE ("c"."game_id" = "g"."id")) "stats" ON (true))
  WHERE ("g"."is_published" = true);


--
-- Name: game_generation_queue; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE "public"."game_generation_queue" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "game_name" "text" NOT NULL,
    "status" "text" DEFAULT 'pending'::"text" NOT NULL,
    "attempts" integer DEFAULT 0 NOT NULL,
    "last_attempted_at" timestamp with time zone,
    "last_error" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "game_generation_queue_status_check" CHECK (("status" = ANY (ARRAY['pending'::"text", 'in_progress'::"text", 'completed'::"text", 'failed'::"text", 'skipped'::"text"])))
);


--
-- Name: game_list_entries; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE "public"."game_list_entries" (
    "list_id" "uuid" NOT NULL,
    "game_id" "uuid",
    "rank" integer NOT NULL,
    "metric_value" numeric,
    "reason" "text",
    "extra" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "universe_id" bigint NOT NULL
);


--
-- Name: game_lists; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE "public"."game_lists" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "slug" "text" NOT NULL,
    "title" "text" NOT NULL,
    "hero_md" "text",
    "intro_md" "text",
    "outro_md" "text",
    "meta_title" "text",
    "meta_description" "text",
    "cover_image" "text",
    "list_type" "text" DEFAULT 'sql'::"text" NOT NULL,
    "filter_config" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "limit_count" integer DEFAULT 50 NOT NULL,
    "is_published" boolean DEFAULT false NOT NULL,
    "refreshed_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "display_name" "text",
    "primary_metric_key" "text",
    "primary_metric_label" "text",
    CONSTRAINT "game_lists_limit_count_check" CHECK (("limit_count" > 0)),
    CONSTRAINT "game_lists_list_type_check" CHECK (("list_type" = ANY (ARRAY['sql'::"text", 'manual'::"text", 'hybrid'::"text"])))
);


--
-- Name: game_lists_index_view; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW "public"."game_lists_index_view" WITH ("security_invoker"='true') AS
 SELECT "id",
    "slug",
    "title",
    "display_name",
    "cover_image",
    "limit_count",
    "refreshed_at",
    "updated_at",
    "created_at",
    "is_published",
    COALESCE(( SELECT COALESCE("g3"."cover_image", "u3"."icon_url") AS "coalesce"
           FROM (("public"."game_list_entries" "gle3"
             LEFT JOIN "public"."games" "g3" ON (("g3"."id" = "gle3"."game_id")))
             LEFT JOIN "public"."roblox_universes" "u3" ON (("u3"."universe_id" = "gle3"."universe_id")))
          WHERE ("gle3"."list_id" = "l"."id")
          ORDER BY "gle3"."rank"
         LIMIT 1), NULL::"text") AS "top_entry_image"
   FROM "public"."game_lists" "l"
  WHERE ("is_published" = true);


--
-- Name: game_lists_view; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW "public"."game_lists_view" AS
SELECT
    NULL::"uuid" AS "id",
    NULL::"text" AS "slug",
    NULL::"text" AS "title",
    NULL::"text" AS "hero_md",
    NULL::"text" AS "intro_md",
    NULL::"text" AS "outro_md",
    NULL::"text" AS "meta_title",
    NULL::"text" AS "meta_description",
    NULL::"text" AS "cover_image",
    NULL::"text" AS "list_type",
    NULL::"jsonb" AS "filter_config",
    NULL::integer AS "limit_count",
    NULL::boolean AS "is_published",
    NULL::timestamp with time zone AS "refreshed_at",
    NULL::timestamp with time zone AS "created_at",
    NULL::timestamp with time zone AS "updated_at",
    NULL::"text" AS "display_name",
    NULL::"text" AS "primary_metric_key",
    NULL::"text" AS "primary_metric_label",
    NULL::"jsonb" AS "entries",
    NULL::"jsonb" AS "other_lists";


--
-- Name: game_pages_index_view; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW "public"."game_pages_index_view" WITH ("security_invoker"='true') AS
 SELECT "g"."id",
    "g"."slug",
    "g"."name",
    "g"."is_published",
    "g"."cover_image",
    "g"."updated_at",
    "g"."created_at",
    "g"."author_id",
    "g"."universe_id",
    "g"."internal_links",
    COALESCE("cs"."active_code_count", (0)::bigint) AS "active_code_count",
    "cs"."latest_code_first_seen_at",
    GREATEST(COALESCE("cs"."latest_code_first_seen_at", "g"."updated_at"), "g"."updated_at") AS "content_updated_at",
    "u"."genre_l1",
    "u"."genre_l2",
        CASE
            WHEN ("a"."id" IS NULL) THEN NULL::"jsonb"
            ELSE "jsonb_build_object"('id', "a"."id", 'name', "a"."name", 'slug', "a"."slug")
        END AS "author"
   FROM ((("public"."games" "g"
     LEFT JOIN ( SELECT "codes"."game_id",
            "count"(*) FILTER (WHERE ("codes"."status" = 'active'::"text")) AS "active_code_count",
            "max"("codes"."first_seen_at") FILTER (WHERE ("codes"."status" = 'active'::"text")) AS "latest_code_first_seen_at"
           FROM "public"."codes"
          GROUP BY "codes"."game_id") "cs" ON (("cs"."game_id" = "g"."id")))
     LEFT JOIN "public"."authors" "a" ON (("a"."id" = "g"."author_id")))
     LEFT JOIN "public"."roblox_universes" "u" ON (("u"."universe_id" = "g"."universe_id")))
  WHERE ("g"."is_published" IS NOT NULL);


--
-- Name: roblox_catalog_items; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE "public"."roblox_catalog_items" (
    "asset_id" bigint NOT NULL,
    "item_type" "text" DEFAULT 'Asset'::"text" NOT NULL,
    "asset_type_id" integer,
    "category" "text",
    "subcategory" "text",
    "name" "text",
    "description" "text",
    "price_robux" bigint,
    "price_status" "text",
    "lowest_price_robux" bigint,
    "lowest_resale_price_robux" bigint,
    "is_for_sale" boolean,
    "is_limited" boolean,
    "is_limited_unique" boolean,
    "remaining" bigint,
    "creator_id" bigint,
    "creator_target_id" bigint,
    "creator_name" "text",
    "creator_type" "text",
    "creator_has_verified_badge" boolean,
    "product_id" bigint,
    "collectible_item_id" bigint,
    "favorite_count" bigint,
    "has_resellers" boolean,
    "total_quantity" bigint,
    "units_available_for_consumption" bigint,
    "quantity_limit_per_user" bigint,
    "sale_location_type" "text",
    "off_sale_deadline" timestamp with time zone,
    "item_status" "jsonb",
    "item_restrictions" "jsonb",
    "bundled_items" "jsonb",
    "first_seen_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "last_seen_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "last_enriched_at" timestamp with time zone,
    "is_deleted" boolean DEFAULT false NOT NULL,
    "raw_catalog_json" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "raw_economy_json" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "rap" bigint,
    "rap_sales" integer,
    "rap_stock" integer,
    "rap_price_points" "jsonb" DEFAULT '[]'::"jsonb",
    "rap_volume_points" "jsonb" DEFAULT '[]'::"jsonb",
    "rap_last_fetched" timestamp with time zone,
    "trading_value" bigint,
    "trading_value_confidence" integer,
    "trend_direction" "text",
    "trend_strength" integer,
    "trend_change_7d" numeric,
    "trend_change_30d" numeric,
    "demand_level" "text",
    "demand_score" integer,
    "demand_sales_per_day" numeric,
    "demand_consistency" integer,
    "is_projected" boolean DEFAULT false,
    "projected_confidence" integer,
    "projected_reason" "text",
    "trading_metrics_calculated_at" timestamp with time zone,
    "limited_type" "text",
    CONSTRAINT "roblox_catalog_items_demand_consistency_check" CHECK ((("demand_consistency" >= 0) AND ("demand_consistency" <= 100))),
    CONSTRAINT "roblox_catalog_items_demand_level_check" CHECK (("demand_level" = ANY (ARRAY['amazing'::"text", 'popular'::"text", 'normal'::"text", 'terrible'::"text"]))),
    CONSTRAINT "roblox_catalog_items_demand_score_check" CHECK ((("demand_score" >= 0) AND ("demand_score" <= 100))),
    CONSTRAINT "roblox_catalog_items_limited_type_check" CHECK (("limited_type" = ANY (ARRAY['classic'::"text", 'ugc'::"text"]))),
    CONSTRAINT "roblox_catalog_items_projected_confidence_check" CHECK ((("projected_confidence" >= 0) AND ("projected_confidence" <= 100))),
    CONSTRAINT "roblox_catalog_items_trading_value_confidence_check" CHECK ((("trading_value_confidence" >= 0) AND ("trading_value_confidence" <= 100))),
    CONSTRAINT "roblox_catalog_items_trend_direction_check" CHECK (("trend_direction" = ANY (ARRAY['rising'::"text", 'stable'::"text", 'falling'::"text"]))),
    CONSTRAINT "roblox_catalog_items_trend_strength_check" CHECK ((("trend_strength" >= 0) AND ("trend_strength" <= 100)))
);


--
-- Name: limited_items_trading_view; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW "public"."limited_items_trading_view" WITH ("security_invoker"='true') AS
 SELECT "asset_id",
    "name",
    "description",
    "item_type",
    "asset_type_id",
    "category",
    "subcategory",
    "is_limited",
    "is_limited_unique",
    "creator_name",
    "creator_type",
    "creator_has_verified_badge",
    "remaining",
    "rap",
    "rap_sales",
    "rap_stock",
    "rap_last_fetched",
    "trading_value",
    "trading_value_confidence",
    "trend_direction",
    "trend_strength",
    "trend_change_7d",
    "trend_change_30d",
    "demand_level",
    "demand_score",
    "demand_sales_per_day",
    "demand_consistency",
    "is_projected",
    "projected_confidence",
    "projected_reason",
    "trading_metrics_calculated_at",
    "updated_at",
    "created_at",
        CASE
            WHEN ("is_projected" = true) THEN 'projected'::"text"
            WHEN ("demand_level" = 'amazing'::"text") THEN 'high_demand'::"text"
            WHEN (("trend_direction" = 'rising'::"text") AND ("trend_strength" > 70)) THEN 'trending_up'::"text"
            WHEN (("rap" IS NOT NULL) AND ("trading_value" IS NULL)) THEN 'needs_calculation'::"text"
            ELSE 'normal'::"text"
        END AS "status_flag",
        CASE
            WHEN (("rap" IS NOT NULL) AND ("trading_value" IS NOT NULL) AND ("rap" > 0)) THEN "round"((((("rap" - "trading_value"))::numeric / ("rap")::numeric) * (100)::numeric), 2)
            ELSE NULL::numeric
        END AS "rap_value_diff_percent",
        CASE
            WHEN ("rap_last_fetched" IS NULL) THEN 'never_fetched'::"text"
            WHEN ("rap_last_fetched" > ("now"() - '12:00:00'::interval)) THEN 'fresh'::"text"
            WHEN ("rap_last_fetched" > ("now"() - '24:00:00'::interval)) THEN 'recent'::"text"
            WHEN ("rap_last_fetched" > ("now"() - '7 days'::interval)) THEN 'stale'::"text"
            ELSE 'outdated'::"text"
        END AS "data_freshness",
        CASE
            WHEN ("trading_metrics_calculated_at" IS NULL) THEN 'never_calculated'::"text"
            WHEN ("trading_metrics_calculated_at" > ("now"() - '01:00:00'::interval)) THEN 'fresh'::"text"
            WHEN ("trading_metrics_calculated_at" > ("now"() - '06:00:00'::interval)) THEN 'recent'::"text"
            WHEN ("trading_metrics_calculated_at" > ("now"() - '24:00:00'::interval)) THEN 'stale'::"text"
            ELSE 'outdated'::"text"
        END AS "metrics_freshness"
   FROM "public"."roblox_catalog_items" "ci"
  WHERE (("is_limited" = true) OR ("is_limited_unique" = true));


--
-- Name: quiz_pages; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE "public"."quiz_pages" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "universe_id" bigint,
    "code" "text" NOT NULL,
    "title" "text" NOT NULL,
    "description_md" "text",
    "seo_title" "text",
    "seo_description" "text",
    "is_published" boolean DEFAULT true NOT NULL,
    "published_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "about_md" "text"
);


--
-- Name: quiz_pages_view; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW "public"."quiz_pages_view" WITH ("security_invoker"='true') AS
 SELECT "qp"."id",
    "qp"."universe_id",
    "qp"."code",
    "qp"."title",
    "qp"."description_md",
    "qp"."seo_title",
    "qp"."seo_description",
    "qp"."is_published",
    "qp"."published_at",
    "qp"."created_at",
    "qp"."updated_at",
    "qp"."about_md",
    GREATEST("qp"."updated_at", COALESCE("qp"."published_at", "qp"."updated_at")) AS "content_updated_at",
        CASE
            WHEN ("u"."universe_id" IS NULL) THEN NULL::"jsonb"
            ELSE "jsonb_build_object"('universe_id', "u"."universe_id", 'slug', "u"."slug", 'display_name', "u"."display_name", 'name', "u"."name", 'icon_url', "u"."icon_url", 'thumbnail_urls', "u"."thumbnail_urls", 'genre_l1', "u"."genre_l1", 'genre_l2', "u"."genre_l2")
        END AS "universe"
   FROM ("public"."quiz_pages" "qp"
     LEFT JOIN "public"."roblox_universes" "u" ON (("u"."universe_id" = "qp"."universe_id")));


--
-- Name: revalidation_events; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE "public"."revalidation_events" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "entity_type" "text" NOT NULL,
    "slug" "text" NOT NULL,
    "source" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "revalidation_events_entity_type_check" CHECK (("entity_type" = ANY (ARRAY['code'::"text", 'article'::"text", 'list'::"text", 'author'::"text", 'event'::"text", 'checklist'::"text", 'tool'::"text", 'catalog'::"text", 'music'::"text", 'quiz'::"text", 'wiki'::"text"])))
);


--
-- Name: roblox_catalog_categories; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE "public"."roblox_catalog_categories" (
    "category" "text" NOT NULL,
    "name" "text",
    "category_id" integer,
    "order_index" integer,
    "is_searchable" boolean,
    "asset_type_ids" integer[] DEFAULT '{}'::integer[] NOT NULL,
    "bundle_type_ids" integer[] DEFAULT '{}'::integer[] NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


--
-- Name: roblox_catalog_discovery_hits; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE "public"."roblox_catalog_discovery_hits" (
    "run_id" "uuid" NOT NULL,
    "asset_id" bigint NOT NULL,
    "query_hash" "text",
    "category" "text",
    "subcategory" "text",
    "keyword" "text",
    "sort_type" "text",
    "cursor_page" integer,
    "seen_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


--
-- Name: roblox_catalog_discovery_runs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE "public"."roblox_catalog_discovery_runs" (
    "run_id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "strategy" "text" NOT NULL,
    "category" "text",
    "subcategory" "text",
    "keyword" "text",
    "sort_type" "text",
    "page_limit" integer,
    "status" "text" DEFAULT 'running'::"text" NOT NULL,
    "started_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "finished_at" timestamp with time zone,
    "notes" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


--
-- Name: roblox_catalog_item_images; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE "public"."roblox_catalog_item_images" (
    "asset_id" bigint NOT NULL,
    "size" "text" NOT NULL,
    "format" "text" NOT NULL,
    "image_url" "text",
    "state" "text",
    "version" "text",
    "last_checked_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


--
-- Name: roblox_catalog_items_history; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE "public"."roblox_catalog_items_history" (
    "asset_id" bigint NOT NULL,
    "recorded_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "rap" bigint,
    "sales" integer,
    "price_robux" bigint,
    "is_for_sale" boolean,
    "favorite_count" bigint
);


--
-- Name: roblox_catalog_refresh_queue; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE "public"."roblox_catalog_refresh_queue" (
    "asset_id" bigint NOT NULL,
    "priority" "text" DEFAULT 'new'::"text" NOT NULL,
    "next_run_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "attempts" integer DEFAULT 0 NOT NULL,
    "last_attempt_at" timestamp with time zone,
    "last_error" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


--
-- Name: roblox_catalog_subcategories; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE "public"."roblox_catalog_subcategories" (
    "subcategory" "text" NOT NULL,
    "category" "text" NOT NULL,
    "name" "text",
    "short_name" "text",
    "subcategory_id" integer,
    "asset_type_ids" integer[] DEFAULT '{}'::integer[] NOT NULL,
    "bundle_type_ids" integer[] DEFAULT '{}'::integer[] NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


--
-- Name: roblox_groups; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE "public"."roblox_groups" (
    "group_id" bigint NOT NULL,
    "name" "text" NOT NULL,
    "description" "text",
    "member_count" bigint,
    "owner_id" bigint,
    "owner_name" "text",
    "has_verified_badge" boolean,
    "raw_payload" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


--
-- Name: roblox_music_ids; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE "public"."roblox_music_ids" (
    "asset_id" bigint NOT NULL,
    "title" "text" NOT NULL,
    "artist" "text" NOT NULL,
    "album" "text",
    "duration_seconds" integer,
    "album_art_asset_id" bigint,
    "rank" integer,
    "source" "text" DEFAULT 'music_discovery_top_songs'::"text" NOT NULL,
    "raw_payload" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "first_seen_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "last_seen_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "genre" "text",
    "boombox_ready" boolean DEFAULT false NOT NULL,
    "boombox_ready_reason" "text",
    "verified_at" timestamp with time zone,
    "product_info_json" "jsonb",
    "asset_delivery_status" integer,
    "vote_count" bigint,
    "upvote_percent" integer,
    "creator_verified" boolean,
    "popularity_score" double precision DEFAULT 0 NOT NULL,
    "thumbnail_url" "text"
);


--
-- Name: roblox_music_artists_view; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW "public"."roblox_music_artists_view" WITH ("security_invoker"='true') AS
 WITH "normalized" AS (
         SELECT TRIM(BOTH FROM "roblox_music_ids"."artist") AS "label",
            "regexp_replace"(TRIM(BOTH FROM "regexp_replace"("replace"("lower"(TRIM(BOTH FROM "roblox_music_ids"."artist")), '&'::"text", 'and'::"text"), '[^a-z0-9]+'::"text", ' '::"text", 'g'::"text")), '\s+'::"text", '-'::"text", 'g'::"text") AS "slug"
           FROM "public"."roblox_music_ids"
          WHERE (("roblox_music_ids"."artist" IS NOT NULL) AND (TRIM(BOTH FROM "roblox_music_ids"."artist") <> ''::"text"))
        )
 SELECT "slug",
    ("array_agg"("label" ORDER BY ("length"("label")) DESC, "normalized"."label"))[1] AS "label",
    ("count"(*))::integer AS "item_count"
   FROM "normalized"
  WHERE ("slug" <> ''::"text")
  GROUP BY "slug";


--
-- Name: roblox_music_genres_view; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW "public"."roblox_music_genres_view" WITH ("security_invoker"='true') AS
 WITH "normalized" AS (
         SELECT TRIM(BOTH FROM "roblox_music_ids"."genre") AS "label",
            "regexp_replace"(TRIM(BOTH FROM "regexp_replace"("replace"("lower"(TRIM(BOTH FROM "roblox_music_ids"."genre")), '&'::"text", 'and'::"text"), '[^a-z0-9]+'::"text", ' '::"text", 'g'::"text")), '\s+'::"text", '-'::"text", 'g'::"text") AS "slug"
           FROM "public"."roblox_music_ids"
          WHERE (("roblox_music_ids"."genre" IS NOT NULL) AND (TRIM(BOTH FROM "roblox_music_ids"."genre") <> ''::"text"))
        )
 SELECT "slug",
    ("array_agg"("label" ORDER BY ("length"("label")) DESC, "normalized"."label"))[1] AS "label",
    ("count"(*))::integer AS "item_count"
   FROM "normalized"
  WHERE ("slug" <> ''::"text")
  GROUP BY "slug";


--
-- Name: roblox_music_ids_boombox_view; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW "public"."roblox_music_ids_boombox_view" WITH ("security_invoker"='true') AS
 SELECT "asset_id",
    "title",
    "artist",
    "album",
    "genre",
    "duration_seconds",
    "album_art_asset_id",
    "thumbnail_url",
    "rank",
    "source",
    "raw_payload",
    "first_seen_at",
    "last_seen_at",
    "created_at",
    "updated_at",
    "boombox_ready",
    "boombox_ready_reason",
    "verified_at",
    "product_info_json",
    "asset_delivery_status",
    "vote_count",
    "upvote_percent",
    "creator_verified",
    "popularity_score"
   FROM "public"."roblox_music_ids"
  WHERE ("boombox_ready" IS TRUE);


--
-- Name: roblox_music_ids_ranked_view; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW "public"."roblox_music_ids_ranked_view" WITH ("security_invoker"='true') AS
 SELECT "asset_id",
    "title",
    "artist",
    "album",
    "duration_seconds",
    "album_art_asset_id",
    "rank",
    "source",
    "raw_payload",
    "first_seen_at",
    "last_seen_at",
    "created_at",
    "updated_at",
    "genre",
    "boombox_ready",
    "boombox_ready_reason",
    "verified_at",
    "product_info_json",
    "asset_delivery_status",
    "vote_count",
    "upvote_percent",
    "creator_verified",
    "popularity_score",
    "thumbnail_url",
        CASE
            WHEN (("duration_seconds" IS NULL) OR ("duration_seconds" <= 0)) THEN 999
            WHEN (("duration_seconds" >= 90) AND ("duration_seconds" <= 300)) THEN 0
            WHEN ("duration_seconds" < 90) THEN ("ceil"((((90 - "duration_seconds"))::numeric / (30)::numeric)))::integer
            ELSE ("ceil"(((("duration_seconds" - 300))::numeric / (30)::numeric)))::integer
        END AS "duration_bucket"
   FROM "public"."roblox_music_ids" "rm";


--
-- Name: roblox_universe_badges; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE "public"."roblox_universe_badges" (
    "badge_id" bigint NOT NULL,
    "universe_id" bigint NOT NULL,
    "name" "text" NOT NULL,
    "description" "text",
    "icon_image_id" bigint,
    "icon_image_url" "text",
    "awarding_badge_asset_id" bigint,
    "enabled" boolean,
    "awarded_count" bigint,
    "awarded_past_day" bigint,
    "awarded_past_week" bigint,
    "rarity_percent" numeric,
    "stats_updated_at" timestamp with time zone,
    "created_at_api" timestamp with time zone,
    "updated_at_api" timestamp with time zone,
    "raw_payload" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL
);


--
-- Name: roblox_universe_gamepasses; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE "public"."roblox_universe_gamepasses" (
    "pass_id" bigint NOT NULL,
    "universe_id" bigint NOT NULL,
    "product_id" bigint,
    "name" "text" NOT NULL,
    "description" "text",
    "price" integer,
    "is_for_sale" boolean,
    "sales" bigint,
    "icon_image_id" bigint,
    "icon_image_url" "text",
    "created_at_api" timestamp with time zone,
    "updated_at_api" timestamp with time zone,
    "raw_payload" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL
);


--
-- Name: roblox_universe_media; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE "public"."roblox_universe_media" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "universe_id" bigint NOT NULL,
    "media_type" "text" NOT NULL,
    "image_url" "text",
    "video_url" "text",
    "alt_text" "text",
    "is_primary" boolean DEFAULT false NOT NULL,
    "approved" boolean,
    "extra" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "fetched_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "roblox_universe_media_media_type_check" CHECK (("media_type" = ANY (ARRAY['icon'::"text", 'screenshot'::"text", 'video'::"text"])))
);


--
-- Name: roblox_universe_place_servers; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE "public"."roblox_universe_place_servers" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "place_id" bigint NOT NULL,
    "universe_id" bigint,
    "server_id" "text" NOT NULL,
    "region" "text",
    "ping_ms" integer,
    "fps" numeric,
    "player_count" integer,
    "max_players" integer,
    "player_list" "jsonb" DEFAULT '[]'::"jsonb" NOT NULL,
    "fetched_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


--
-- Name: roblox_universe_search_snapshots; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE "public"."roblox_universe_search_snapshots" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "query" "text" NOT NULL,
    "universe_id" bigint NOT NULL,
    "place_id" bigint,
    "position" integer,
    "session_id" "uuid" NOT NULL,
    "relevance_score" numeric,
    "has_verified_badge" boolean,
    "is_sponsored" boolean,
    "source" "text" DEFAULT 'omni-search'::"text" NOT NULL,
    "raw_payload" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "fetched_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


--
-- Name: roblox_universe_social_links; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE "public"."roblox_universe_social_links" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "universe_id" bigint NOT NULL,
    "platform" "text" NOT NULL,
    "title" "text",
    "url" "text" NOT NULL,
    "raw_payload" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "fetched_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


--
-- Name: roblox_universe_sort_definitions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE "public"."roblox_universe_sort_definitions" (
    "sort_id" "text" NOT NULL,
    "title" "text",
    "description" "text",
    "layout" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "experiments" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "last_seen_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


--
-- Name: roblox_universe_sort_entries; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE "public"."roblox_universe_sort_entries" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "sort_id" "text" NOT NULL,
    "universe_id" bigint NOT NULL,
    "place_id" bigint,
    "rank" integer,
    "session_id" "uuid" NOT NULL,
    "run_id" "uuid",
    "device" "text",
    "country" "text",
    "source" "text" DEFAULT 'explore'::"text" NOT NULL,
    "is_sponsored" boolean,
    "fetched_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


--
-- Name: roblox_universe_sort_runs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE "public"."roblox_universe_sort_runs" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "session_id" "uuid" NOT NULL,
    "device" "text" NOT NULL,
    "country" "text" NOT NULL,
    "retrieved_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


--
-- Name: roblox_universe_stats_daily; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE "public"."roblox_universe_stats_daily" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "universe_id" bigint NOT NULL,
    "stat_date" "date" NOT NULL,
    "playing" bigint,
    "visits" bigint,
    "favorites" bigint,
    "likes" bigint,
    "dislikes" bigint,
    "premium_visits" bigint,
    "premium_upsells" bigint,
    "engagement_score" numeric,
    "payout_robux" numeric,
    "snapshot" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "recorded_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


--
-- Name: roblox_virtual_event_categories; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE "public"."roblox_virtual_event_categories" (
    "event_id" "text" NOT NULL,
    "category" "text" NOT NULL,
    "rank" integer NOT NULL
);


--
-- Name: roblox_virtual_event_thumbnails; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE "public"."roblox_virtual_event_thumbnails" (
    "event_id" "text" NOT NULL,
    "media_id" bigint NOT NULL,
    "rank" integer NOT NULL
);


--
-- Name: roblox_virtual_events; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE "public"."roblox_virtual_events" (
    "event_id" "text" NOT NULL,
    "universe_id" bigint NOT NULL,
    "place_id" bigint,
    "title" "text",
    "display_title" "text",
    "subtitle" "text",
    "display_subtitle" "text",
    "description" "text",
    "display_description" "text",
    "tagline" "text",
    "start_utc" timestamp with time zone,
    "end_utc" timestamp with time zone,
    "created_utc" timestamp with time zone,
    "updated_utc" timestamp with time zone,
    "event_status" "text",
    "event_visibility" "text",
    "featuring_status" "text",
    "all_thumbnails_created" boolean,
    "host_name" "text",
    "host_has_verified_badge" boolean,
    "host_type" "text",
    "host_id" bigint,
    "raw_event_json" "jsonb",
    "event_summary_md" "text",
    "event_details_md" "text",
    "guide_slug" "text",
    "first_live_at" timestamp with time zone
);


--
-- Name: search_index; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE "public"."search_index" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "entity_type" "text" NOT NULL,
    "entity_id" "text" NOT NULL,
    "slug" "text" NOT NULL,
    "title" "text" NOT NULL,
    "subtitle" "text",
    "url" "text" NOT NULL,
    "updated_at" timestamp with time zone,
    "is_published" boolean DEFAULT true NOT NULL,
    "search_text" "text" DEFAULT ''::"text" NOT NULL,
    "search_vector" "tsvector" GENERATED ALWAYS AS ("to_tsvector"('"english"'::"regconfig", "search_text")) STORED
);


--
-- Name: tools; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE "public"."tools" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "code" "text" NOT NULL,
    "title" "text" NOT NULL,
    "seo_title" "text" NOT NULL,
    "meta_description" "text" NOT NULL,
    "intro_md" "text" NOT NULL,
    "how_it_works_md" "text" NOT NULL,
    "description_json" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "faq_json" "jsonb" DEFAULT '[]'::"jsonb" NOT NULL,
    "cta_label" "text",
    "cta_url" "text",
    "schema_ld_json" "jsonb",
    "thumb_url" "text",
    "is_published" boolean DEFAULT true NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "published_at" timestamp with time zone,
    "universe_id" bigint
);


--
-- Name: tools_view; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW "public"."tools_view" WITH ("security_invoker"='true') AS
 SELECT "id",
    "code",
    "title",
    "seo_title",
    "meta_description",
    "intro_md",
    "how_it_works_md",
    "description_json",
    "faq_json",
    "cta_label",
    "cta_url",
    "schema_ld_json",
    "thumb_url",
    "is_published",
    "created_at",
    "updated_at",
    "published_at",
    "universe_id",
    GREATEST("updated_at", COALESCE("published_at", "updated_at")) AS "content_updated_at"
   FROM "public"."tools" "t";


--
-- Name: user_checklist_progress; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE "public"."user_checklist_progress" (
    "user_id" "uuid" NOT NULL,
    "checklist_slug" "text" NOT NULL,
    "checked_item_ids" "text"[] DEFAULT '{}'::"text"[] NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


--
-- Name: user_code_progress; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE "public"."user_code_progress" (
    "user_id" "uuid" NOT NULL,
    "game_slug" "text" NOT NULL,
    "used_code_ids" "text"[] DEFAULT '{}'::"text"[] NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


--
-- Name: user_quiz_progress; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE "public"."user_quiz_progress" (
    "user_id" "uuid" NOT NULL,
    "quiz_code" "text" NOT NULL,
    "seen_question_ids" "text"[] DEFAULT '{}'::"text"[] NOT NULL,
    "last_score" integer,
    "last_total" integer,
    "last_breakdown" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "last_attempt_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


--
-- Name: wiki_pages; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE "public"."wiki_pages" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "slug" "text" NOT NULL,
    "title" "text" NOT NULL,
    "seo_title" "text",
    "meta_description" "text",
    "universe_id" bigint,
    "controls_json" "jsonb" DEFAULT '[]'::"jsonb" NOT NULL,
    "tips_md" "text",
    "is_published" boolean DEFAULT false NOT NULL,
    "published_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "wiki_pages_slug_not_empty" CHECK (("length"(TRIM(BOTH FROM "slug")) > 0))
);


--
-- Name: wiki_pages_view; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW "public"."wiki_pages_view" WITH ("security_invoker"='true') AS
 SELECT "wp"."id",
    "wp"."slug",
    "wp"."title",
    "wp"."seo_title",
    "wp"."meta_description",
    "wp"."universe_id",
    "wp"."controls_json",
    "wp"."tips_md",
    "wp"."is_published",
    "wp"."published_at",
    "wp"."created_at",
    "wp"."updated_at",
    GREATEST("wp"."updated_at", COALESCE("wp"."published_at", "wp"."updated_at")) AS "content_updated_at",
    "u"."root_place_id" AS "universe_root_place_id",
    "u"."name" AS "universe_name",
    "u"."display_name" AS "universe_display_name",
    "u"."slug" AS "universe_slug",
    "u"."description" AS "universe_description",
    "u"."game_description_md" AS "universe_game_description_md",
    "u"."creator_id" AS "universe_creator_id",
    "u"."creator_name" AS "universe_creator_name",
    "u"."creator_type" AS "universe_creator_type",
    "u"."creator_has_verified_badge" AS "universe_creator_has_verified_badge",
    "u"."group_id" AS "universe_group_id",
    "u"."group_name" AS "universe_group_name",
    "u"."group_has_verified_badge" AS "universe_group_has_verified_badge",
    "u"."genre" AS "universe_genre",
    "u"."genre_l1" AS "universe_genre_l1",
    "u"."genre_l2" AS "universe_genre_l2",
    "u"."age_rating" AS "universe_age_rating",
    "u"."universe_avatar_type",
    "u"."desktop_enabled",
    "u"."mobile_enabled",
    "u"."tablet_enabled",
    "u"."console_enabled",
    "u"."vr_enabled",
    "u"."voice_chat_enabled",
    "u"."price",
    "u"."private_server_price_robux",
    "u"."create_vip_servers_allowed",
    "u"."max_players",
    "u"."server_size",
    "u"."playing",
    "u"."visits",
    "u"."favorites",
    "u"."likes",
    "u"."dislikes",
    "u"."icon_url",
    "u"."thumbnail_urls",
    "u"."social_links",
    "u"."created_at_api",
    "u"."updated_at_api",
    "u"."updated_at" AS "universe_updated_at"
   FROM ("public"."wiki_pages" "wp"
     LEFT JOIN "public"."roblox_universes" "u" ON (("u"."universe_id" = "wp"."universe_id")));


--
-- Name: app_sessions app_sessions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."app_sessions"
    ADD CONSTRAINT "app_sessions_pkey" PRIMARY KEY ("id");


--
-- Name: app_users app_users_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."app_users"
    ADD CONSTRAINT "app_users_pkey" PRIMARY KEY ("user_id");


--
-- Name: article_generation_artifacts article_generation_artifacts_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."article_generation_artifacts"
    ADD CONSTRAINT "article_generation_artifacts_pkey" PRIMARY KEY ("id");


--
-- Name: article_generation_queue article_generation_queue_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."article_generation_queue"
    ADD CONSTRAINT "article_generation_queue_pkey" PRIMARY KEY ("id");


--
-- Name: article_source_images article_source_images_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."article_source_images"
    ADD CONSTRAINT "article_source_images_pkey" PRIMARY KEY ("id");


--
-- Name: articles articles_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."articles"
    ADD CONSTRAINT "articles_pkey" PRIMARY KEY ("id");


--
-- Name: articles articles_slug_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."articles"
    ADD CONSTRAINT "articles_slug_key" UNIQUE ("slug");


--
-- Name: authors authors_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."authors"
    ADD CONSTRAINT "authors_pkey" PRIMARY KEY ("id");


--
-- Name: authors authors_slug_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."authors"
    ADD CONSTRAINT "authors_slug_key" UNIQUE ("slug");


--
-- Name: catalog_pages catalog_pages_code_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."catalog_pages"
    ADD CONSTRAINT "catalog_pages_code_key" UNIQUE ("code");


--
-- Name: catalog_pages catalog_pages_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."catalog_pages"
    ADD CONSTRAINT "catalog_pages_pkey" PRIMARY KEY ("id");


--
-- Name: checklist_items checklist_items_page_id_section_code_title_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."checklist_items"
    ADD CONSTRAINT "checklist_items_page_id_section_code_title_key" UNIQUE ("page_id", "section_code", "title");


--
-- Name: checklist_items checklist_items_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."checklist_items"
    ADD CONSTRAINT "checklist_items_pkey" PRIMARY KEY ("id");


--
-- Name: checklist_pages checklist_pages_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."checklist_pages"
    ADD CONSTRAINT "checklist_pages_pkey" PRIMARY KEY ("id");


--
-- Name: checklist_pages checklist_pages_universe_id_slug_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."checklist_pages"
    ADD CONSTRAINT "checklist_pages_universe_id_slug_key" UNIQUE ("universe_id", "slug");


--
-- Name: codes codes_game_id_code_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."codes"
    ADD CONSTRAINT "codes_game_id_code_key" UNIQUE ("game_id", "code");


--
-- Name: codes codes_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."codes"
    ADD CONSTRAINT "codes_pkey" PRIMARY KEY ("id");


--
-- Name: comments comments_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."comments"
    ADD CONSTRAINT "comments_pkey" PRIMARY KEY ("id");


--
-- Name: event_guide_generation_queue event_guide_generation_queue_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."event_guide_generation_queue"
    ADD CONSTRAINT "event_guide_generation_queue_pkey" PRIMARY KEY ("id");


--
-- Name: events_pages events_pages_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."events_pages"
    ADD CONSTRAINT "events_pages_pkey" PRIMARY KEY ("id");


--
-- Name: events_pages events_pages_universe_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."events_pages"
    ADD CONSTRAINT "events_pages_universe_id_key" UNIQUE ("universe_id");


--
-- Name: game_generation_queue game_generation_queue_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."game_generation_queue"
    ADD CONSTRAINT "game_generation_queue_pkey" PRIMARY KEY ("id");


--
-- Name: game_list_entries game_list_entries_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."game_list_entries"
    ADD CONSTRAINT "game_list_entries_pkey" PRIMARY KEY ("list_id", "universe_id");


--
-- Name: game_lists game_lists_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."game_lists"
    ADD CONSTRAINT "game_lists_pkey" PRIMARY KEY ("id");


--
-- Name: game_lists game_lists_slug_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."game_lists"
    ADD CONSTRAINT "game_lists_slug_key" UNIQUE ("slug");


--
-- Name: games games_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."games"
    ADD CONSTRAINT "games_pkey" PRIMARY KEY ("id");


--
-- Name: games games_slug_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."games"
    ADD CONSTRAINT "games_slug_key" UNIQUE ("slug");


--
-- Name: quiz_pages quiz_pages_code_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."quiz_pages"
    ADD CONSTRAINT "quiz_pages_code_key" UNIQUE ("code");


--
-- Name: quiz_pages quiz_pages_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."quiz_pages"
    ADD CONSTRAINT "quiz_pages_pkey" PRIMARY KEY ("id");


--
-- Name: revalidation_events revalidation_events_entity_slug_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."revalidation_events"
    ADD CONSTRAINT "revalidation_events_entity_slug_key" UNIQUE ("entity_type", "slug");


--
-- Name: revalidation_events revalidation_events_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."revalidation_events"
    ADD CONSTRAINT "revalidation_events_pkey" PRIMARY KEY ("id");


--
-- Name: roblox_catalog_categories roblox_catalog_categories_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."roblox_catalog_categories"
    ADD CONSTRAINT "roblox_catalog_categories_pkey" PRIMARY KEY ("category");


--
-- Name: roblox_catalog_discovery_hits roblox_catalog_discovery_hits_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."roblox_catalog_discovery_hits"
    ADD CONSTRAINT "roblox_catalog_discovery_hits_pkey" PRIMARY KEY ("run_id", "asset_id");


--
-- Name: roblox_catalog_discovery_runs roblox_catalog_discovery_runs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."roblox_catalog_discovery_runs"
    ADD CONSTRAINT "roblox_catalog_discovery_runs_pkey" PRIMARY KEY ("run_id");


--
-- Name: roblox_catalog_item_images roblox_catalog_item_images_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."roblox_catalog_item_images"
    ADD CONSTRAINT "roblox_catalog_item_images_pkey" PRIMARY KEY ("asset_id", "size", "format");


--
-- Name: roblox_catalog_items_history roblox_catalog_items_history_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."roblox_catalog_items_history"
    ADD CONSTRAINT "roblox_catalog_items_history_pkey" PRIMARY KEY ("asset_id", "recorded_at");


--
-- Name: roblox_catalog_items roblox_catalog_items_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."roblox_catalog_items"
    ADD CONSTRAINT "roblox_catalog_items_pkey" PRIMARY KEY ("asset_id");


--
-- Name: roblox_catalog_refresh_queue roblox_catalog_refresh_queue_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."roblox_catalog_refresh_queue"
    ADD CONSTRAINT "roblox_catalog_refresh_queue_pkey" PRIMARY KEY ("asset_id");


--
-- Name: roblox_catalog_subcategories roblox_catalog_subcategories_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."roblox_catalog_subcategories"
    ADD CONSTRAINT "roblox_catalog_subcategories_pkey" PRIMARY KEY ("subcategory");


--
-- Name: roblox_groups roblox_groups_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."roblox_groups"
    ADD CONSTRAINT "roblox_groups_pkey" PRIMARY KEY ("group_id");


--
-- Name: roblox_music_ids roblox_music_ids_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."roblox_music_ids"
    ADD CONSTRAINT "roblox_music_ids_pkey" PRIMARY KEY ("asset_id");


--
-- Name: roblox_universe_badges roblox_universe_badges_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."roblox_universe_badges"
    ADD CONSTRAINT "roblox_universe_badges_pkey" PRIMARY KEY ("badge_id");


--
-- Name: roblox_universe_gamepasses roblox_universe_gamepasses_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."roblox_universe_gamepasses"
    ADD CONSTRAINT "roblox_universe_gamepasses_pkey" PRIMARY KEY ("pass_id");


--
-- Name: roblox_universe_media roblox_universe_media_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."roblox_universe_media"
    ADD CONSTRAINT "roblox_universe_media_pkey" PRIMARY KEY ("id");


--
-- Name: roblox_universe_place_servers roblox_universe_place_servers_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."roblox_universe_place_servers"
    ADD CONSTRAINT "roblox_universe_place_servers_pkey" PRIMARY KEY ("id");


--
-- Name: roblox_universe_place_servers roblox_universe_place_servers_place_id_server_id_fetched_at_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."roblox_universe_place_servers"
    ADD CONSTRAINT "roblox_universe_place_servers_place_id_server_id_fetched_at_key" UNIQUE ("place_id", "server_id", "fetched_at");


--
-- Name: roblox_universe_search_snapshots roblox_universe_search_snapshots_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."roblox_universe_search_snapshots"
    ADD CONSTRAINT "roblox_universe_search_snapshots_pkey" PRIMARY KEY ("id");


--
-- Name: roblox_universe_social_links roblox_universe_social_links_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."roblox_universe_social_links"
    ADD CONSTRAINT "roblox_universe_social_links_pkey" PRIMARY KEY ("id");


--
-- Name: roblox_universe_social_links roblox_universe_social_links_universe_id_platform_url_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."roblox_universe_social_links"
    ADD CONSTRAINT "roblox_universe_social_links_universe_id_platform_url_key" UNIQUE ("universe_id", "platform", "url");


--
-- Name: roblox_universe_sort_definitions roblox_universe_sort_definitions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."roblox_universe_sort_definitions"
    ADD CONSTRAINT "roblox_universe_sort_definitions_pkey" PRIMARY KEY ("sort_id");


--
-- Name: roblox_universe_sort_entries roblox_universe_sort_entries_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."roblox_universe_sort_entries"
    ADD CONSTRAINT "roblox_universe_sort_entries_pkey" PRIMARY KEY ("id");


--
-- Name: roblox_universe_sort_entries roblox_universe_sort_entries_sort_id_universe_id_session_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."roblox_universe_sort_entries"
    ADD CONSTRAINT "roblox_universe_sort_entries_sort_id_universe_id_session_id_key" UNIQUE ("sort_id", "universe_id", "session_id", "fetched_at");


--
-- Name: roblox_universe_sort_runs roblox_universe_sort_runs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."roblox_universe_sort_runs"
    ADD CONSTRAINT "roblox_universe_sort_runs_pkey" PRIMARY KEY ("id");


--
-- Name: roblox_universe_stats_daily roblox_universe_stats_daily_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."roblox_universe_stats_daily"
    ADD CONSTRAINT "roblox_universe_stats_daily_pkey" PRIMARY KEY ("id");


--
-- Name: roblox_universe_stats_daily roblox_universe_stats_daily_universe_id_stat_date_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."roblox_universe_stats_daily"
    ADD CONSTRAINT "roblox_universe_stats_daily_universe_id_stat_date_key" UNIQUE ("universe_id", "stat_date");


--
-- Name: roblox_universes roblox_universes_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."roblox_universes"
    ADD CONSTRAINT "roblox_universes_pkey" PRIMARY KEY ("universe_id");


--
-- Name: roblox_virtual_event_categories roblox_virtual_event_categories_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."roblox_virtual_event_categories"
    ADD CONSTRAINT "roblox_virtual_event_categories_pkey" PRIMARY KEY ("event_id", "rank");


--
-- Name: roblox_virtual_event_thumbnails roblox_virtual_event_thumbnails_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."roblox_virtual_event_thumbnails"
    ADD CONSTRAINT "roblox_virtual_event_thumbnails_pkey" PRIMARY KEY ("event_id", "rank");


--
-- Name: roblox_virtual_events roblox_virtual_events_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."roblox_virtual_events"
    ADD CONSTRAINT "roblox_virtual_events_pkey" PRIMARY KEY ("event_id");


--
-- Name: search_index search_index_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."search_index"
    ADD CONSTRAINT "search_index_pkey" PRIMARY KEY ("id");


--
-- Name: tools tools_code_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."tools"
    ADD CONSTRAINT "tools_code_key" UNIQUE ("code");


--
-- Name: tools tools_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."tools"
    ADD CONSTRAINT "tools_pkey" PRIMARY KEY ("id");


--
-- Name: user_checklist_progress user_checklist_progress_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."user_checklist_progress"
    ADD CONSTRAINT "user_checklist_progress_pkey" PRIMARY KEY ("user_id", "checklist_slug");


--
-- Name: user_code_progress user_code_progress_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."user_code_progress"
    ADD CONSTRAINT "user_code_progress_pkey" PRIMARY KEY ("user_id", "game_slug");


--
-- Name: user_quiz_progress user_quiz_progress_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."user_quiz_progress"
    ADD CONSTRAINT "user_quiz_progress_pkey" PRIMARY KEY ("user_id", "quiz_code");


--
-- Name: wiki_pages wiki_pages_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."wiki_pages"
    ADD CONSTRAINT "wiki_pages_pkey" PRIMARY KEY ("id");


--
-- Name: idx_app_sessions_expires_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "idx_app_sessions_expires_at" ON "public"."app_sessions" USING "btree" ("expires_at");


--
-- Name: idx_app_sessions_revoked_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "idx_app_sessions_revoked_at" ON "public"."app_sessions" USING "btree" ("revoked_at");


--
-- Name: idx_app_sessions_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "idx_app_sessions_user_id" ON "public"."app_sessions" USING "btree" ("user_id");


--
-- Name: idx_app_users_roblox_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "idx_app_users_roblox_user_id" ON "public"."app_users" USING "btree" ("roblox_user_id") WHERE ("roblox_user_id" IS NOT NULL);


--
-- Name: idx_app_users_role; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "idx_app_users_role" ON "public"."app_users" USING "btree" ("role");


--
-- Name: idx_article_generation_artifacts_article; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "idx_article_generation_artifacts_article" ON "public"."article_generation_artifacts" USING "btree" ("article_id", "created_at" DESC);


--
-- Name: idx_article_generation_artifacts_queue; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "idx_article_generation_artifacts_queue" ON "public"."article_generation_artifacts" USING "btree" ("queue_id", "created_at" DESC);


--
-- Name: idx_article_generation_queue_active_idempotency; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "idx_article_generation_queue_active_idempotency" ON "public"."article_generation_queue" USING "btree" ("idempotency_key") WHERE (("status" = ANY (ARRAY['pending'::"text", 'processing'::"text"])) AND ("event_id" IS NULL) AND ("idempotency_key" IS NOT NULL));


--
-- Name: idx_article_generation_queue_event_id; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "idx_article_generation_queue_event_id" ON "public"."article_generation_queue" USING "btree" ("event_id") WHERE ("event_id" IS NOT NULL);


--
-- Name: idx_article_generation_queue_pending_backoff; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "idx_article_generation_queue_pending_backoff" ON "public"."article_generation_queue" USING "btree" ("status", "next_attempt_at", "created_at");


--
-- Name: idx_article_generation_queue_status_created; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "idx_article_generation_queue_status_created" ON "public"."article_generation_queue" USING "btree" ("status", "created_at");


--
-- Name: idx_article_source_images_article; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "idx_article_source_images_article" ON "public"."article_source_images" USING "btree" ("article_id");


--
-- Name: idx_article_source_images_source; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "idx_article_source_images_source" ON "public"."article_source_images" USING "btree" ("source_host", "source_url");


--
-- Name: idx_articles_author; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "idx_articles_author" ON "public"."articles" USING "btree" ("author_id", "is_published");


--
-- Name: idx_articles_published; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "idx_articles_published" ON "public"."articles" USING "btree" ("is_published");


--
-- Name: idx_articles_published_published_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "idx_articles_published_published_at" ON "public"."articles" USING "btree" ("is_published", "published_at" DESC);


--
-- Name: idx_articles_slug; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "idx_articles_slug" ON "public"."articles" USING "btree" ("lower"("slug"));


--
-- Name: idx_articles_universe; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "idx_articles_universe" ON "public"."articles" USING "btree" ("universe_id");


--
-- Name: idx_catalog_pages_is_published; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "idx_catalog_pages_is_published" ON "public"."catalog_pages" USING "btree" ("is_published");


--
-- Name: idx_catalog_pages_universe_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "idx_catalog_pages_universe_id" ON "public"."catalog_pages" USING "btree" ("universe_id");


--
-- Name: idx_catalog_pages_universe_wiki_sort; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "idx_catalog_pages_universe_wiki_sort" ON "public"."catalog_pages" USING "btree" ("universe_id", "wiki_sort_order") WHERE ("is_published" = true);


--
-- Name: idx_checklist_items_page; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "idx_checklist_items_page" ON "public"."checklist_items" USING "btree" ("page_id");


--
-- Name: idx_checklist_items_page_section; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "idx_checklist_items_page_section" ON "public"."checklist_items" USING "btree" ("page_id", "section_code");


--
-- Name: idx_checklist_pages_published; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "idx_checklist_pages_published" ON "public"."checklist_pages" USING "btree" ("is_public", "published_at" DESC NULLS LAST, "updated_at" DESC);


--
-- Name: idx_checklist_pages_universe_slug; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "idx_checklist_pages_universe_slug" ON "public"."checklist_pages" USING "btree" ("universe_id", "lower"("slug"));


--
-- Name: idx_codes_game_code_upper; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "idx_codes_game_code_upper" ON "public"."codes" USING "btree" ("game_id", "upper"("code"));


--
-- Name: idx_codes_game_first_seen; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "idx_codes_game_first_seen" ON "public"."codes" USING "btree" ("game_id", "first_seen_at" DESC);


--
-- Name: idx_codes_game_status_seen; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "idx_codes_game_status_seen" ON "public"."codes" USING "btree" ("game_id", "status", "last_seen_at" DESC);


--
-- Name: idx_codes_status_game; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "idx_codes_status_game" ON "public"."codes" USING "btree" ("status", "game_id");


--
-- Name: idx_comments_author; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "idx_comments_author" ON "public"."comments" USING "btree" ("author_id");


--
-- Name: idx_comments_entity_created; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "idx_comments_entity_created" ON "public"."comments" USING "btree" ("entity_type", "entity_id", "created_at" DESC);


--
-- Name: idx_comments_parent; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "idx_comments_parent" ON "public"."comments" USING "btree" ("parent_id");


--
-- Name: idx_event_guide_generation_queue_event_id; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "idx_event_guide_generation_queue_event_id" ON "public"."event_guide_generation_queue" USING "btree" ("event_id");


--
-- Name: idx_event_guide_generation_queue_status_created; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "idx_event_guide_generation_queue_status_created" ON "public"."event_guide_generation_queue" USING "btree" ("status", "created_at");


--
-- Name: idx_events_pages_author; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "idx_events_pages_author" ON "public"."events_pages" USING "btree" ("author_id", "is_published");


--
-- Name: idx_events_pages_is_published; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "idx_events_pages_is_published" ON "public"."events_pages" USING "btree" ("is_published");


--
-- Name: idx_events_pages_slug; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "idx_events_pages_slug" ON "public"."events_pages" USING "btree" ("slug");


--
-- Name: idx_game_generation_queue_status_created; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "idx_game_generation_queue_status_created" ON "public"."game_generation_queue" USING "btree" ("status", "created_at");


--
-- Name: idx_game_list_entries_game; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "idx_game_list_entries_game" ON "public"."game_list_entries" USING "btree" ("game_id");


--
-- Name: idx_game_list_entries_rank; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "idx_game_list_entries_rank" ON "public"."game_list_entries" USING "btree" ("list_id", "rank");


--
-- Name: idx_game_list_entries_universe; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "idx_game_list_entries_universe" ON "public"."game_list_entries" USING "btree" ("universe_id");


--
-- Name: idx_game_lists_published; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "idx_game_lists_published" ON "public"."game_lists" USING "btree" ("is_published", "updated_at" DESC);


--
-- Name: idx_game_lists_slug; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "idx_game_lists_slug" ON "public"."game_lists" USING "btree" ("lower"("slug"));


--
-- Name: idx_games_author_published; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "idx_games_author_published" ON "public"."games" USING "btree" ("author_id", "is_published");


--
-- Name: idx_games_old_slugs; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "idx_games_old_slugs" ON "public"."games" USING "gin" ("old_slugs");


--
-- Name: idx_games_published; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "idx_games_published" ON "public"."games" USING "btree" ("is_published");


--
-- Name: idx_games_published_name; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "idx_games_published_name" ON "public"."games" USING "btree" ("is_published", "name");


--
-- Name: idx_games_published_updated; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "idx_games_published_updated" ON "public"."games" USING "btree" ("is_published", "updated_at" DESC);


--
-- Name: idx_games_slug; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "idx_games_slug" ON "public"."games" USING "btree" ("lower"("slug"));


--
-- Name: idx_games_universe_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "idx_games_universe_id" ON "public"."games" USING "btree" ("universe_id");


--
-- Name: idx_quiz_pages_is_published; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "idx_quiz_pages_is_published" ON "public"."quiz_pages" USING "btree" ("is_published", "published_at" DESC NULLS LAST, "updated_at" DESC);


--
-- Name: idx_quiz_pages_universe_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "idx_quiz_pages_universe_id" ON "public"."quiz_pages" USING "btree" ("universe_id");


--
-- Name: idx_revalidation_events_created; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "idx_revalidation_events_created" ON "public"."revalidation_events" USING "btree" ("created_at" DESC);


--
-- Name: idx_revalidation_events_type_slug; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "idx_revalidation_events_type_slug" ON "public"."revalidation_events" USING "btree" ("entity_type", "slug");


--
-- Name: idx_roblox_catalog_discovery_hits_asset_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "idx_roblox_catalog_discovery_hits_asset_id" ON "public"."roblox_catalog_discovery_hits" USING "btree" ("asset_id");


--
-- Name: idx_roblox_catalog_discovery_hits_query_hash; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "idx_roblox_catalog_discovery_hits_query_hash" ON "public"."roblox_catalog_discovery_hits" USING "btree" ("query_hash");


--
-- Name: idx_roblox_catalog_discovery_runs_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "idx_roblox_catalog_discovery_runs_status" ON "public"."roblox_catalog_discovery_runs" USING "btree" ("status");


--
-- Name: idx_roblox_catalog_item_images_state; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "idx_roblox_catalog_item_images_state" ON "public"."roblox_catalog_item_images" USING "btree" ("state");


--
-- Name: idx_roblox_catalog_items_asset_type_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "idx_roblox_catalog_items_asset_type_id" ON "public"."roblox_catalog_items" USING "btree" ("asset_type_id");


--
-- Name: idx_roblox_catalog_items_category; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "idx_roblox_catalog_items_category" ON "public"."roblox_catalog_items" USING "btree" ("category");


--
-- Name: idx_roblox_catalog_items_creator_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "idx_roblox_catalog_items_creator_id" ON "public"."roblox_catalog_items" USING "btree" ("creator_id");


--
-- Name: idx_roblox_catalog_items_demand_level; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "idx_roblox_catalog_items_demand_level" ON "public"."roblox_catalog_items" USING "btree" ("demand_level", "trading_value" DESC NULLS LAST) WHERE (("is_limited" = true) OR ("is_limited_unique" = true));


--
-- Name: idx_roblox_catalog_items_history_asset; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "idx_roblox_catalog_items_history_asset" ON "public"."roblox_catalog_items_history" USING "btree" ("asset_id", "recorded_at" DESC);


--
-- Name: idx_roblox_catalog_items_history_recorded_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "idx_roblox_catalog_items_history_recorded_at" ON "public"."roblox_catalog_items_history" USING "btree" ("recorded_at" DESC);


--
-- Name: idx_roblox_catalog_items_is_for_sale; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "idx_roblox_catalog_items_is_for_sale" ON "public"."roblox_catalog_items" USING "btree" ("is_for_sale");


--
-- Name: idx_roblox_catalog_items_is_limited; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "idx_roblox_catalog_items_is_limited" ON "public"."roblox_catalog_items" USING "btree" ("is_limited");


--
-- Name: idx_roblox_catalog_items_last_seen_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "idx_roblox_catalog_items_last_seen_at" ON "public"."roblox_catalog_items" USING "btree" ("last_seen_at" DESC);


--
-- Name: idx_roblox_catalog_items_limited_tradeable; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "idx_roblox_catalog_items_limited_tradeable" ON "public"."roblox_catalog_items" USING "btree" ("is_limited", "is_limited_unique", "trading_value" DESC NULLS LAST) WHERE ((("is_limited" = true) OR ("is_limited_unique" = true)) AND ("trading_value" IS NOT NULL));


--
-- Name: idx_roblox_catalog_items_price_robux; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "idx_roblox_catalog_items_price_robux" ON "public"."roblox_catalog_items" USING "btree" ("price_robux");


--
-- Name: idx_roblox_catalog_items_projected; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "idx_roblox_catalog_items_projected" ON "public"."roblox_catalog_items" USING "btree" ("is_projected", "trading_value" DESC NULLS LAST) WHERE (("is_limited" = true) OR ("is_limited_unique" = true));


--
-- Name: idx_roblox_catalog_items_rap; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "idx_roblox_catalog_items_rap" ON "public"."roblox_catalog_items" USING "btree" ("rap" DESC NULLS LAST) WHERE (("is_limited" = true) OR ("is_limited_unique" = true));


--
-- Name: idx_roblox_catalog_items_rap_last_fetched; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "idx_roblox_catalog_items_rap_last_fetched" ON "public"."roblox_catalog_items" USING "btree" ("rap_last_fetched" DESC NULLS LAST) WHERE (("is_limited" = true) OR ("is_limited_unique" = true));


--
-- Name: idx_roblox_catalog_items_subcategory; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "idx_roblox_catalog_items_subcategory" ON "public"."roblox_catalog_items" USING "btree" ("subcategory");


--
-- Name: idx_roblox_catalog_items_trading_value; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "idx_roblox_catalog_items_trading_value" ON "public"."roblox_catalog_items" USING "btree" ("trading_value" DESC NULLS LAST) WHERE (("is_limited" = true) OR ("is_limited_unique" = true));


--
-- Name: idx_roblox_catalog_items_trend_direction; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "idx_roblox_catalog_items_trend_direction" ON "public"."roblox_catalog_items" USING "btree" ("trend_direction", "trading_value" DESC NULLS LAST) WHERE (("is_limited" = true) OR ("is_limited_unique" = true));


--
-- Name: idx_roblox_catalog_refresh_queue_next_run_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "idx_roblox_catalog_refresh_queue_next_run_at" ON "public"."roblox_catalog_refresh_queue" USING "btree" ("next_run_at");


--
-- Name: idx_roblox_catalog_refresh_queue_priority; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "idx_roblox_catalog_refresh_queue_priority" ON "public"."roblox_catalog_refresh_queue" USING "btree" ("priority");


--
-- Name: idx_roblox_catalog_subcategories_category; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "idx_roblox_catalog_subcategories_category" ON "public"."roblox_catalog_subcategories" USING "btree" ("category");


--
-- Name: idx_roblox_music_ids_boombox_ready; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "idx_roblox_music_ids_boombox_ready" ON "public"."roblox_music_ids" USING "btree" ("boombox_ready");


--
-- Name: idx_roblox_music_ids_last_seen; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "idx_roblox_music_ids_last_seen" ON "public"."roblox_music_ids" USING "btree" ("last_seen_at" DESC);


--
-- Name: idx_roblox_music_ids_popularity_score; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "idx_roblox_music_ids_popularity_score" ON "public"."roblox_music_ids" USING "btree" ("popularity_score" DESC);


--
-- Name: idx_roblox_music_ids_rank; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "idx_roblox_music_ids_rank" ON "public"."roblox_music_ids" USING "btree" ("rank");


--
-- Name: idx_roblox_music_ids_verified_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "idx_roblox_music_ids_verified_at" ON "public"."roblox_music_ids" USING "btree" ("verified_at");


--
-- Name: idx_roblox_universe_badges; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "idx_roblox_universe_badges" ON "public"."roblox_universe_badges" USING "btree" ("universe_id");


--
-- Name: idx_roblox_universe_gamepasses; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "idx_roblox_universe_gamepasses" ON "public"."roblox_universe_gamepasses" USING "btree" ("universe_id");


--
-- Name: idx_roblox_universe_media_universe; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "idx_roblox_universe_media_universe" ON "public"."roblox_universe_media" USING "btree" ("universe_id", "media_type");


--
-- Name: idx_roblox_universe_place_servers_place; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "idx_roblox_universe_place_servers_place" ON "public"."roblox_universe_place_servers" USING "btree" ("place_id", "fetched_at" DESC);


--
-- Name: idx_roblox_universe_place_servers_universe; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "idx_roblox_universe_place_servers_universe" ON "public"."roblox_universe_place_servers" USING "btree" ("universe_id", "fetched_at" DESC);


--
-- Name: idx_roblox_universe_search_snapshots_query; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "idx_roblox_universe_search_snapshots_query" ON "public"."roblox_universe_search_snapshots" USING "btree" ("query", "fetched_at" DESC);


--
-- Name: idx_roblox_universe_search_snapshots_universe; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "idx_roblox_universe_search_snapshots_universe" ON "public"."roblox_universe_search_snapshots" USING "btree" ("universe_id", "fetched_at" DESC);


--
-- Name: idx_roblox_universe_sort_entries_sort; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "idx_roblox_universe_sort_entries_sort" ON "public"."roblox_universe_sort_entries" USING "btree" ("sort_id", "fetched_at" DESC);


--
-- Name: idx_roblox_universe_sort_entries_universe; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "idx_roblox_universe_sort_entries_universe" ON "public"."roblox_universe_sort_entries" USING "btree" ("universe_id", "fetched_at" DESC);


--
-- Name: idx_roblox_universe_stats_daily; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "idx_roblox_universe_stats_daily" ON "public"."roblox_universe_stats_daily" USING "btree" ("universe_id", "stat_date" DESC);


--
-- Name: idx_roblox_universes_creator; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "idx_roblox_universes_creator" ON "public"."roblox_universes" USING "btree" ("creator_id");


--
-- Name: idx_roblox_universes_seen; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "idx_roblox_universes_seen" ON "public"."roblox_universes" USING "btree" (COALESCE("last_seen_in_sort", "last_seen_in_search") DESC);


--
-- Name: idx_roblox_universes_slug; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "idx_roblox_universes_slug" ON "public"."roblox_universes" USING "btree" ("lower"("slug"));


--
-- Name: idx_roblox_virtual_events_event_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "idx_roblox_virtual_events_event_status" ON "public"."roblox_virtual_events" USING "btree" ("event_status");


--
-- Name: idx_roblox_virtual_events_first_live_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "idx_roblox_virtual_events_first_live_at" ON "public"."roblox_virtual_events" USING "btree" ("first_live_at");


--
-- Name: idx_roblox_virtual_events_start_utc; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "idx_roblox_virtual_events_start_utc" ON "public"."roblox_virtual_events" USING "btree" ("start_utc");


--
-- Name: idx_roblox_virtual_events_universe_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "idx_roblox_virtual_events_universe_id" ON "public"."roblox_virtual_events" USING "btree" ("universe_id");


--
-- Name: idx_search_index_entity; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "idx_search_index_entity" ON "public"."search_index" USING "btree" ("entity_type", "entity_id");


--
-- Name: idx_search_index_published_updated; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "idx_search_index_published_updated" ON "public"."search_index" USING "btree" ("is_published", "updated_at" DESC);


--
-- Name: idx_search_index_search_text_trgm; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "idx_search_index_search_text_trgm" ON "public"."search_index" USING "gin" ("search_text" "extensions"."gin_trgm_ops");


--
-- Name: idx_search_index_type_slug; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "idx_search_index_type_slug" ON "public"."search_index" USING "btree" ("entity_type", "slug");


--
-- Name: idx_search_index_vector; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "idx_search_index_vector" ON "public"."search_index" USING "gin" ("search_vector");


--
-- Name: idx_tools_is_published; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "idx_tools_is_published" ON "public"."tools" USING "btree" ("is_published");


--
-- Name: idx_user_checklist_progress_slug; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "idx_user_checklist_progress_slug" ON "public"."user_checklist_progress" USING "btree" ("checklist_slug");


--
-- Name: idx_user_code_progress_slug; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "idx_user_code_progress_slug" ON "public"."user_code_progress" USING "btree" ("game_slug");


--
-- Name: idx_user_quiz_progress_code; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "idx_user_quiz_progress_code" ON "public"."user_quiz_progress" USING "btree" ("quiz_code");


--
-- Name: idx_wiki_pages_published; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "idx_wiki_pages_published" ON "public"."wiki_pages" USING "btree" ("is_published", "published_at" DESC NULLS LAST, "updated_at" DESC);


--
-- Name: idx_wiki_pages_slug_lower; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "idx_wiki_pages_slug_lower" ON "public"."wiki_pages" USING "btree" ("lower"("slug"));


--
-- Name: idx_wiki_pages_universe_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "idx_wiki_pages_universe_id" ON "public"."wiki_pages" USING "btree" ("universe_id");


--
-- Name: game_lists_view _RETURN; Type: RULE; Schema: public; Owner: -
--

CREATE OR REPLACE VIEW "public"."game_lists_view" WITH ("security_invoker"='true') AS
 WITH "code_stats" AS (
         SELECT "c"."game_id",
            "count"(*) FILTER (WHERE ("c"."status" = 'active'::"text")) AS "active_code_count",
            "max"("c"."first_seen_at") FILTER (WHERE ("c"."status" = 'active'::"text")) AS "latest_code_first_seen_at"
           FROM "public"."codes" "c"
          GROUP BY "c"."game_id"
        )
 SELECT "l"."id",
    "l"."slug",
    "l"."title",
    "l"."hero_md",
    "l"."intro_md",
    "l"."outro_md",
    "l"."meta_title",
    "l"."meta_description",
    "l"."cover_image",
    "l"."list_type",
    "l"."filter_config",
    "l"."limit_count",
    "l"."is_published",
    "l"."refreshed_at",
    "l"."created_at",
    "l"."updated_at",
    "l"."display_name",
    "l"."primary_metric_key",
    "l"."primary_metric_label",
    COALESCE("jsonb_agg"("jsonb_build_object"('universe_id', "e"."universe_id", 'list_id', "e"."list_id", 'rank', "e"."rank", 'metric_value', "e"."metric_value", 'reason', "e"."reason", 'extra', "e"."extra", 'game_id', "e"."game_id", 'game',
        CASE
            WHEN ("g"."id" IS NULL) THEN NULL::"jsonb"
            ELSE "jsonb_build_object"('id', "g"."id", 'name', "g"."name", 'slug', "g"."slug", 'cover_image', "g"."cover_image", 'universe_id', "g"."universe_id", 'active_count', COALESCE("cs"."active_code_count", (0)::bigint), 'active_code_count', COALESCE("cs"."active_code_count", (0)::bigint), 'content_updated_at', GREATEST(COALESCE("cs"."latest_code_first_seen_at", "g"."updated_at"), "g"."updated_at"))
        END, 'universe',
        CASE
            WHEN ("u"."universe_id" IS NULL) THEN NULL::"jsonb"
            ELSE "jsonb_build_object"('universe_id', "u"."universe_id", 'slug', "u"."slug", 'display_name', "u"."display_name", 'name', "u"."name", 'icon_url', "u"."icon_url", 'playing', "u"."playing", 'visits', "u"."visits", 'favorites', "u"."favorites", 'likes', "u"."likes", 'dislikes', "u"."dislikes", 'age_rating', "u"."age_rating", 'desktop_enabled', "u"."desktop_enabled", 'mobile_enabled', "u"."mobile_enabled", 'tablet_enabled', "u"."tablet_enabled", 'console_enabled', "u"."console_enabled", 'vr_enabled', "u"."vr_enabled", 'updated_at', "u"."updated_at", 'description', COALESCE("u"."game_description_md", "u"."description"), 'game_description_md', "u"."game_description_md")
        END, 'badges', ( SELECT COALESCE("jsonb_agg"("rec".* ORDER BY "rec"."rank"), '[]'::"jsonb") AS "coalesce"
           FROM ( SELECT "gle2"."list_id",
                    "gl2"."slug" AS "list_slug",
                    "gl2"."title" AS "list_title",
                    "gl2"."display_name" AS "list_display_name",
                    "gle2"."rank"
                   FROM ("public"."game_list_entries" "gle2"
                     JOIN "public"."game_lists" "gl2" ON ((("gl2"."id" = "gle2"."list_id") AND ("gl2"."is_published" = true))))
                  WHERE (("gle2"."universe_id" = "e"."universe_id") AND ("gl2"."id" <> "l"."id") AND (("gle2"."rank" >= 1) AND ("gle2"."rank" <= 3)))
                  ORDER BY "gle2"."rank"
                 LIMIT 3) "rec")) ORDER BY "e"."rank") FILTER (WHERE ("e"."universe_id" IS NOT NULL)), '[]'::"jsonb") AS "entries",
    ( SELECT COALESCE("jsonb_agg"("rec".* ORDER BY "rec"."updated_at" DESC), '[]'::"jsonb") AS "coalesce"
           FROM ( SELECT "l2"."id",
                    "l2"."slug",
                    "l2"."title",
                    "l2"."display_name",
                    "l2"."updated_at"
                   FROM "public"."game_lists" "l2"
                  WHERE (("l2"."is_published" = true) AND ("l2"."id" <> "l"."id"))
                  ORDER BY "l2"."updated_at" DESC
                 LIMIT 6) "rec") AS "other_lists"
   FROM (((("public"."game_lists" "l"
     LEFT JOIN "public"."game_list_entries" "e" ON (("e"."list_id" = "l"."id")))
     LEFT JOIN "public"."roblox_universes" "u" ON (("u"."universe_id" = "e"."universe_id")))
     LEFT JOIN "public"."games" "g" ON (("g"."id" = "e"."game_id")))
     LEFT JOIN "code_stats" "cs" ON (("cs"."game_id" = "g"."id")))
  GROUP BY "l"."id";


--
-- Name: app_sessions trg_app_sessions_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER "trg_app_sessions_updated_at" BEFORE UPDATE ON "public"."app_sessions" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();


--
-- Name: app_users trg_app_users_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER "trg_app_users_updated_at" BEFORE UPDATE ON "public"."app_users" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();


--
-- Name: article_generation_artifacts trg_article_generation_artifacts_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER "trg_article_generation_artifacts_updated_at" BEFORE UPDATE ON "public"."article_generation_artifacts" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();


--
-- Name: article_generation_queue trg_article_generation_queue_idempotency_key; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER "trg_article_generation_queue_idempotency_key" BEFORE INSERT OR UPDATE OF "article_title", "universe_id" ON "public"."article_generation_queue" FOR EACH ROW EXECUTE FUNCTION "public"."set_article_generation_queue_idempotency_key"();


--
-- Name: article_generation_queue trg_article_generation_queue_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER "trg_article_generation_queue_updated_at" BEFORE UPDATE ON "public"."article_generation_queue" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();


--
-- Name: articles trg_articles_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER "trg_articles_updated_at" BEFORE UPDATE ON "public"."articles" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();


--
-- Name: authors trg_authors_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER "trg_authors_updated_at" BEFORE UPDATE ON "public"."authors" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();


--
-- Name: catalog_pages trg_catalog_pages_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER "trg_catalog_pages_updated_at" BEFORE UPDATE ON "public"."catalog_pages" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();


--
-- Name: checklist_items trg_checklist_items_normalize; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER "trg_checklist_items_normalize" BEFORE INSERT OR UPDATE ON "public"."checklist_items" FOR EACH ROW EXECUTE FUNCTION "public"."trg_normalize_section_code"();


--
-- Name: checklist_items trg_checklist_items_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER "trg_checklist_items_updated_at" BEFORE UPDATE ON "public"."checklist_items" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();


--
-- Name: checklist_pages trg_checklist_pages_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER "trg_checklist_pages_updated_at" BEFORE UPDATE ON "public"."checklist_pages" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();


--
-- Name: comments trg_comments_revalidate_code; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER "trg_comments_revalidate_code" AFTER INSERT OR UPDATE ON "public"."comments" FOR EACH ROW EXECUTE FUNCTION "public"."trg_comments_revalidate_code"();


--
-- Name: comments trg_comments_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER "trg_comments_updated_at" BEFORE UPDATE ON "public"."comments" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();


--
-- Name: articles trg_enqueue_revalidation_articles; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER "trg_enqueue_revalidation_articles" AFTER INSERT OR DELETE OR UPDATE ON "public"."articles" FOR EACH ROW EXECUTE FUNCTION "public"."trg_enqueue_revalidation_articles"();


--
-- Name: catalog_pages trg_enqueue_revalidation_catalog_pages; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER "trg_enqueue_revalidation_catalog_pages" AFTER INSERT OR DELETE OR UPDATE ON "public"."catalog_pages" FOR EACH ROW EXECUTE FUNCTION "public"."trg_enqueue_revalidation_catalog_pages"();


--
-- Name: checklist_items trg_enqueue_revalidation_checklist_items; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER "trg_enqueue_revalidation_checklist_items" AFTER INSERT OR DELETE OR UPDATE ON "public"."checklist_items" FOR EACH ROW EXECUTE FUNCTION "public"."trg_enqueue_revalidation_checklist_items"();


--
-- Name: checklist_pages trg_enqueue_revalidation_checklist_pages; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER "trg_enqueue_revalidation_checklist_pages" AFTER INSERT OR DELETE OR UPDATE ON "public"."checklist_pages" FOR EACH ROW EXECUTE FUNCTION "public"."trg_enqueue_revalidation_checklist_pages"();


--
-- Name: codes trg_enqueue_revalidation_codes; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER "trg_enqueue_revalidation_codes" AFTER INSERT OR DELETE OR UPDATE ON "public"."codes" FOR EACH ROW EXECUTE FUNCTION "public"."trg_enqueue_revalidation_codes"();


--
-- Name: events_pages trg_enqueue_revalidation_events_pages; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER "trg_enqueue_revalidation_events_pages" AFTER INSERT OR DELETE OR UPDATE ON "public"."events_pages" FOR EACH ROW EXECUTE FUNCTION "public"."trg_enqueue_revalidation_events_pages"();


--
-- Name: roblox_catalog_item_images trg_enqueue_revalidation_free_item_images; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER "trg_enqueue_revalidation_free_item_images" AFTER INSERT OR DELETE OR UPDATE ON "public"."roblox_catalog_item_images" FOR EACH ROW EXECUTE FUNCTION "public"."trg_enqueue_revalidation_free_item_images"();


--
-- Name: roblox_catalog_items trg_enqueue_revalidation_free_items_catalog; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER "trg_enqueue_revalidation_free_items_catalog" AFTER INSERT OR DELETE OR UPDATE ON "public"."roblox_catalog_items" FOR EACH ROW EXECUTE FUNCTION "public"."trg_enqueue_revalidation_free_items_catalog"();


--
-- Name: game_list_entries trg_enqueue_revalidation_game_list_entries; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER "trg_enqueue_revalidation_game_list_entries" AFTER INSERT OR DELETE OR UPDATE ON "public"."game_list_entries" FOR EACH ROW EXECUTE FUNCTION "public"."trg_enqueue_revalidation_game_list_entries"();


--
-- Name: game_lists trg_enqueue_revalidation_game_lists; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER "trg_enqueue_revalidation_game_lists" AFTER INSERT OR DELETE OR UPDATE ON "public"."game_lists" FOR EACH ROW EXECUTE FUNCTION "public"."trg_enqueue_revalidation_game_lists"();


--
-- Name: games trg_enqueue_revalidation_games; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER "trg_enqueue_revalidation_games" AFTER INSERT OR DELETE OR UPDATE ON "public"."games" FOR EACH ROW EXECUTE FUNCTION "public"."trg_enqueue_revalidation_games"();


--
-- Name: roblox_music_ids trg_enqueue_revalidation_music_ids; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER "trg_enqueue_revalidation_music_ids" AFTER INSERT OR DELETE OR UPDATE ON "public"."roblox_music_ids" FOR EACH ROW EXECUTE FUNCTION "public"."trg_enqueue_revalidation_music_ids"();


--
-- Name: quiz_pages trg_enqueue_revalidation_quiz_pages; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER "trg_enqueue_revalidation_quiz_pages" AFTER INSERT OR DELETE OR UPDATE ON "public"."quiz_pages" FOR EACH ROW EXECUTE FUNCTION "public"."trg_enqueue_revalidation_quiz_pages"();


--
-- Name: tools trg_enqueue_revalidation_tools; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER "trg_enqueue_revalidation_tools" AFTER INSERT OR DELETE OR UPDATE ON "public"."tools" FOR EACH ROW EXECUTE FUNCTION "public"."trg_enqueue_revalidation_tools"();


--
-- Name: roblox_virtual_event_categories trg_enqueue_revalidation_virtual_event_categories; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER "trg_enqueue_revalidation_virtual_event_categories" AFTER INSERT OR DELETE OR UPDATE ON "public"."roblox_virtual_event_categories" FOR EACH ROW EXECUTE FUNCTION "public"."trg_enqueue_revalidation_virtual_event_assets"();


--
-- Name: roblox_virtual_event_thumbnails trg_enqueue_revalidation_virtual_event_thumbnails; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER "trg_enqueue_revalidation_virtual_event_thumbnails" AFTER INSERT OR DELETE OR UPDATE ON "public"."roblox_virtual_event_thumbnails" FOR EACH ROW EXECUTE FUNCTION "public"."trg_enqueue_revalidation_virtual_event_assets"();


--
-- Name: roblox_virtual_events trg_enqueue_revalidation_virtual_events; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER "trg_enqueue_revalidation_virtual_events" AFTER INSERT OR DELETE OR UPDATE ON "public"."roblox_virtual_events" FOR EACH ROW EXECUTE FUNCTION "public"."trg_enqueue_revalidation_virtual_events"();


--
-- Name: wiki_pages trg_enqueue_revalidation_wiki_pages; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER "trg_enqueue_revalidation_wiki_pages" AFTER INSERT OR DELETE OR UPDATE ON "public"."wiki_pages" FOR EACH ROW EXECUTE FUNCTION "public"."trg_enqueue_revalidation_wiki_pages"();


--
-- Name: event_guide_generation_queue trg_event_guide_generation_queue_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER "trg_event_guide_generation_queue_updated_at" BEFORE UPDATE ON "public"."event_guide_generation_queue" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();


--
-- Name: events_pages trg_events_pages_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER "trg_events_pages_updated_at" BEFORE UPDATE ON "public"."events_pages" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();


--
-- Name: game_generation_queue trg_game_generation_queue_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER "trg_game_generation_queue_updated_at" BEFORE UPDATE ON "public"."game_generation_queue" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();


--
-- Name: game_list_entries trg_game_list_entries_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER "trg_game_list_entries_updated_at" BEFORE UPDATE ON "public"."game_list_entries" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();


--
-- Name: game_lists trg_game_lists_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER "trg_game_lists_updated_at" BEFORE UPDATE ON "public"."game_lists" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();


--
-- Name: games trg_games_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER "trg_games_updated_at" BEFORE UPDATE ON "public"."games" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();


--
-- Name: quiz_pages trg_quiz_pages_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER "trg_quiz_pages_updated_at" BEFORE UPDATE ON "public"."quiz_pages" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();


--
-- Name: roblox_music_ids trg_refresh_search_index_music; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER "trg_refresh_search_index_music" AFTER INSERT OR DELETE OR UPDATE ON "public"."roblox_music_ids" FOR EACH STATEMENT EXECUTE FUNCTION "public"."trg_refresh_search_index_music"();


--
-- Name: roblox_catalog_categories trg_roblox_catalog_categories_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER "trg_roblox_catalog_categories_updated_at" BEFORE UPDATE ON "public"."roblox_catalog_categories" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();


--
-- Name: roblox_catalog_discovery_runs trg_roblox_catalog_discovery_runs_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER "trg_roblox_catalog_discovery_runs_updated_at" BEFORE UPDATE ON "public"."roblox_catalog_discovery_runs" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();


--
-- Name: roblox_catalog_item_images trg_roblox_catalog_item_images_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER "trg_roblox_catalog_item_images_updated_at" BEFORE UPDATE ON "public"."roblox_catalog_item_images" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();


--
-- Name: roblox_catalog_items trg_roblox_catalog_items_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER "trg_roblox_catalog_items_updated_at" BEFORE UPDATE ON "public"."roblox_catalog_items" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();


--
-- Name: roblox_catalog_refresh_queue trg_roblox_catalog_refresh_queue_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER "trg_roblox_catalog_refresh_queue_updated_at" BEFORE UPDATE ON "public"."roblox_catalog_refresh_queue" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();


--
-- Name: roblox_catalog_subcategories trg_roblox_catalog_subcategories_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER "trg_roblox_catalog_subcategories_updated_at" BEFORE UPDATE ON "public"."roblox_catalog_subcategories" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();


--
-- Name: roblox_music_ids trg_roblox_music_ids_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER "trg_roblox_music_ids_updated_at" BEFORE UPDATE ON "public"."roblox_music_ids" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();


--
-- Name: roblox_universes trg_roblox_universes_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER "trg_roblox_universes_updated_at" BEFORE UPDATE ON "public"."roblox_universes" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();


--
-- Name: articles trg_search_index_articles; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER "trg_search_index_articles" AFTER INSERT OR DELETE OR UPDATE ON "public"."articles" FOR EACH ROW EXECUTE FUNCTION "public"."trg_search_index_articles"();


--
-- Name: authors trg_search_index_authors; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER "trg_search_index_authors" AFTER INSERT OR DELETE OR UPDATE ON "public"."authors" FOR EACH ROW EXECUTE FUNCTION "public"."trg_search_index_authors"();


--
-- Name: catalog_pages trg_search_index_catalog_pages; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER "trg_search_index_catalog_pages" AFTER INSERT OR DELETE OR UPDATE ON "public"."catalog_pages" FOR EACH ROW EXECUTE FUNCTION "public"."trg_search_index_catalog_pages"();


--
-- Name: checklist_pages trg_search_index_checklists; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER "trg_search_index_checklists" AFTER INSERT OR DELETE OR UPDATE ON "public"."checklist_pages" FOR EACH ROW EXECUTE FUNCTION "public"."trg_search_index_checklists"();


--
-- Name: events_pages trg_search_index_events_pages; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER "trg_search_index_events_pages" AFTER INSERT OR DELETE OR UPDATE ON "public"."events_pages" FOR EACH ROW EXECUTE FUNCTION "public"."trg_search_index_events_pages"();


--
-- Name: game_lists trg_search_index_game_lists; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER "trg_search_index_game_lists" AFTER INSERT OR DELETE OR UPDATE ON "public"."game_lists" FOR EACH ROW EXECUTE FUNCTION "public"."trg_search_index_game_lists"();


--
-- Name: games trg_search_index_games; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER "trg_search_index_games" AFTER INSERT OR DELETE OR UPDATE ON "public"."games" FOR EACH ROW EXECUTE FUNCTION "public"."trg_search_index_games"();


--
-- Name: quiz_pages trg_search_index_quiz_pages; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER "trg_search_index_quiz_pages" AFTER INSERT OR DELETE OR UPDATE ON "public"."quiz_pages" FOR EACH ROW EXECUTE FUNCTION "public"."trg_search_index_quiz_pages"();


--
-- Name: tools trg_search_index_tools; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER "trg_search_index_tools" AFTER INSERT OR DELETE OR UPDATE ON "public"."tools" FOR EACH ROW EXECUTE FUNCTION "public"."trg_search_index_tools"();


--
-- Name: wiki_pages trg_search_index_wiki_pages; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER "trg_search_index_wiki_pages" AFTER INSERT OR DELETE OR UPDATE ON "public"."wiki_pages" FOR EACH ROW EXECUTE FUNCTION "public"."trg_search_index_wiki_pages"();


--
-- Name: articles trg_set_article_published_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER "trg_set_article_published_at" BEFORE INSERT OR UPDATE ON "public"."articles" FOR EACH ROW EXECUTE FUNCTION "public"."set_article_published_at"();


--
-- Name: catalog_pages trg_set_catalog_page_published_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER "trg_set_catalog_page_published_at" BEFORE INSERT OR UPDATE ON "public"."catalog_pages" FOR EACH ROW EXECUTE FUNCTION "public"."set_catalog_page_published_at"();


--
-- Name: checklist_pages trg_set_checklist_published_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER "trg_set_checklist_published_at" BEFORE INSERT OR UPDATE ON "public"."checklist_pages" FOR EACH ROW EXECUTE FUNCTION "public"."set_checklist_published_at"();


--
-- Name: events_pages trg_set_events_pages_published_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER "trg_set_events_pages_published_at" BEFORE INSERT OR UPDATE ON "public"."events_pages" FOR EACH ROW EXECUTE FUNCTION "public"."set_catalog_page_published_at"();


--
-- Name: games trg_set_game_published_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER "trg_set_game_published_at" BEFORE INSERT OR UPDATE ON "public"."games" FOR EACH ROW EXECUTE FUNCTION "public"."set_game_published_at"();


--
-- Name: quiz_pages trg_set_quiz_page_published_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER "trg_set_quiz_page_published_at" BEFORE INSERT OR UPDATE ON "public"."quiz_pages" FOR EACH ROW EXECUTE FUNCTION "public"."set_quiz_page_published_at"();


--
-- Name: tools trg_set_tool_published_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER "trg_set_tool_published_at" BEFORE INSERT OR UPDATE ON "public"."tools" FOR EACH ROW EXECUTE FUNCTION "public"."set_tool_published_at"();


--
-- Name: wiki_pages trg_set_wiki_page_published_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER "trg_set_wiki_page_published_at" BEFORE INSERT OR UPDATE ON "public"."wiki_pages" FOR EACH ROW EXECUTE FUNCTION "public"."set_wiki_page_published_at"();


--
-- Name: tools trg_tools_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER "trg_tools_updated_at" BEFORE UPDATE ON "public"."tools" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();


--
-- Name: user_checklist_progress trg_user_checklist_progress_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER "trg_user_checklist_progress_updated_at" BEFORE UPDATE ON "public"."user_checklist_progress" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();


--
-- Name: user_code_progress trg_user_code_progress_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER "trg_user_code_progress_updated_at" BEFORE UPDATE ON "public"."user_code_progress" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();


--
-- Name: user_quiz_progress trg_user_quiz_progress_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER "trg_user_quiz_progress_updated_at" BEFORE UPDATE ON "public"."user_quiz_progress" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();


--
-- Name: wiki_pages trg_wiki_pages_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER "trg_wiki_pages_updated_at" BEFORE UPDATE ON "public"."wiki_pages" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();


--
-- Name: app_sessions app_sessions_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."app_sessions"
    ADD CONSTRAINT "app_sessions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."app_users"("user_id") ON DELETE CASCADE;


--
-- Name: article_generation_artifacts article_generation_artifacts_article_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."article_generation_artifacts"
    ADD CONSTRAINT "article_generation_artifacts_article_id_fkey" FOREIGN KEY ("article_id") REFERENCES "public"."articles"("id") ON DELETE SET NULL;


--
-- Name: article_generation_artifacts article_generation_artifacts_queue_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."article_generation_artifacts"
    ADD CONSTRAINT "article_generation_artifacts_queue_id_fkey" FOREIGN KEY ("queue_id") REFERENCES "public"."article_generation_queue"("id") ON DELETE SET NULL;


--
-- Name: article_generation_artifacts article_generation_artifacts_universe_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."article_generation_artifacts"
    ADD CONSTRAINT "article_generation_artifacts_universe_id_fkey" FOREIGN KEY ("universe_id") REFERENCES "public"."roblox_universes"("universe_id") ON DELETE SET NULL;


--
-- Name: article_generation_queue article_generation_queue_article_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."article_generation_queue"
    ADD CONSTRAINT "article_generation_queue_article_id_fkey" FOREIGN KEY ("article_id") REFERENCES "public"."articles"("id") ON DELETE SET NULL;


--
-- Name: article_generation_queue article_generation_queue_universe_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."article_generation_queue"
    ADD CONSTRAINT "article_generation_queue_universe_id_fkey" FOREIGN KEY ("universe_id") REFERENCES "public"."roblox_universes"("universe_id");


--
-- Name: article_source_images article_source_images_article_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."article_source_images"
    ADD CONSTRAINT "article_source_images_article_id_fkey" FOREIGN KEY ("article_id") REFERENCES "public"."articles"("id") ON DELETE CASCADE;


--
-- Name: articles articles_author_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."articles"
    ADD CONSTRAINT "articles_author_id_fkey" FOREIGN KEY ("author_id") REFERENCES "public"."authors"("id") ON DELETE SET NULL;


--
-- Name: articles articles_universe_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."articles"
    ADD CONSTRAINT "articles_universe_id_fkey" FOREIGN KEY ("universe_id") REFERENCES "public"."roblox_universes"("universe_id");


--
-- Name: catalog_pages catalog_pages_universe_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."catalog_pages"
    ADD CONSTRAINT "catalog_pages_universe_id_fkey" FOREIGN KEY ("universe_id") REFERENCES "public"."roblox_universes"("universe_id") ON DELETE SET NULL;


--
-- Name: checklist_items checklist_items_page_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."checklist_items"
    ADD CONSTRAINT "checklist_items_page_id_fkey" FOREIGN KEY ("page_id") REFERENCES "public"."checklist_pages"("id") ON DELETE CASCADE;


--
-- Name: checklist_pages checklist_pages_universe_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."checklist_pages"
    ADD CONSTRAINT "checklist_pages_universe_id_fkey" FOREIGN KEY ("universe_id") REFERENCES "public"."roblox_universes"("universe_id") ON DELETE CASCADE;


--
-- Name: codes codes_game_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."codes"
    ADD CONSTRAINT "codes_game_id_fkey" FOREIGN KEY ("game_id") REFERENCES "public"."games"("id") ON DELETE CASCADE;


--
-- Name: comments comments_author_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."comments"
    ADD CONSTRAINT "comments_author_id_fkey" FOREIGN KEY ("author_id") REFERENCES "public"."app_users"("user_id") ON DELETE CASCADE;


--
-- Name: comments comments_parent_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."comments"
    ADD CONSTRAINT "comments_parent_id_fkey" FOREIGN KEY ("parent_id") REFERENCES "public"."comments"("id") ON DELETE CASCADE;


--
-- Name: event_guide_generation_queue event_guide_generation_queue_article_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."event_guide_generation_queue"
    ADD CONSTRAINT "event_guide_generation_queue_article_id_fkey" FOREIGN KEY ("article_id") REFERENCES "public"."articles"("id") ON DELETE SET NULL;


--
-- Name: event_guide_generation_queue event_guide_generation_queue_event_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."event_guide_generation_queue"
    ADD CONSTRAINT "event_guide_generation_queue_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "public"."roblox_virtual_events"("event_id") ON DELETE CASCADE;


--
-- Name: event_guide_generation_queue event_guide_generation_queue_universe_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."event_guide_generation_queue"
    ADD CONSTRAINT "event_guide_generation_queue_universe_id_fkey" FOREIGN KEY ("universe_id") REFERENCES "public"."roblox_universes"("universe_id");


--
-- Name: events_pages events_pages_author_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."events_pages"
    ADD CONSTRAINT "events_pages_author_id_fkey" FOREIGN KEY ("author_id") REFERENCES "public"."authors"("id") ON DELETE SET NULL;


--
-- Name: events_pages events_pages_universe_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."events_pages"
    ADD CONSTRAINT "events_pages_universe_id_fkey" FOREIGN KEY ("universe_id") REFERENCES "public"."roblox_universes"("universe_id") ON DELETE CASCADE;


--
-- Name: game_list_entries game_list_entries_game_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."game_list_entries"
    ADD CONSTRAINT "game_list_entries_game_id_fkey" FOREIGN KEY ("game_id") REFERENCES "public"."games"("id") ON DELETE SET NULL;


--
-- Name: game_list_entries game_list_entries_list_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."game_list_entries"
    ADD CONSTRAINT "game_list_entries_list_id_fkey" FOREIGN KEY ("list_id") REFERENCES "public"."game_lists"("id") ON DELETE CASCADE;


--
-- Name: game_list_entries game_list_entries_universe_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."game_list_entries"
    ADD CONSTRAINT "game_list_entries_universe_id_fkey" FOREIGN KEY ("universe_id") REFERENCES "public"."roblox_universes"("universe_id") ON DELETE CASCADE;


--
-- Name: games games_author_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."games"
    ADD CONSTRAINT "games_author_id_fkey" FOREIGN KEY ("author_id") REFERENCES "public"."authors"("id");


--
-- Name: games games_universe_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."games"
    ADD CONSTRAINT "games_universe_id_fkey" FOREIGN KEY ("universe_id") REFERENCES "public"."roblox_universes"("universe_id");


--
-- Name: quiz_pages quiz_pages_universe_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."quiz_pages"
    ADD CONSTRAINT "quiz_pages_universe_id_fkey" FOREIGN KEY ("universe_id") REFERENCES "public"."roblox_universes"("universe_id") ON DELETE SET NULL;


--
-- Name: roblox_catalog_discovery_hits roblox_catalog_discovery_hits_asset_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."roblox_catalog_discovery_hits"
    ADD CONSTRAINT "roblox_catalog_discovery_hits_asset_id_fkey" FOREIGN KEY ("asset_id") REFERENCES "public"."roblox_catalog_items"("asset_id") ON DELETE CASCADE;


--
-- Name: roblox_catalog_discovery_hits roblox_catalog_discovery_hits_run_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."roblox_catalog_discovery_hits"
    ADD CONSTRAINT "roblox_catalog_discovery_hits_run_id_fkey" FOREIGN KEY ("run_id") REFERENCES "public"."roblox_catalog_discovery_runs"("run_id") ON DELETE CASCADE;


--
-- Name: roblox_catalog_item_images roblox_catalog_item_images_asset_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."roblox_catalog_item_images"
    ADD CONSTRAINT "roblox_catalog_item_images_asset_id_fkey" FOREIGN KEY ("asset_id") REFERENCES "public"."roblox_catalog_items"("asset_id") ON DELETE CASCADE;


--
-- Name: roblox_catalog_items_history roblox_catalog_items_history_asset_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."roblox_catalog_items_history"
    ADD CONSTRAINT "roblox_catalog_items_history_asset_id_fkey" FOREIGN KEY ("asset_id") REFERENCES "public"."roblox_catalog_items"("asset_id") ON DELETE CASCADE;


--
-- Name: roblox_catalog_refresh_queue roblox_catalog_refresh_queue_asset_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."roblox_catalog_refresh_queue"
    ADD CONSTRAINT "roblox_catalog_refresh_queue_asset_id_fkey" FOREIGN KEY ("asset_id") REFERENCES "public"."roblox_catalog_items"("asset_id") ON DELETE CASCADE;


--
-- Name: roblox_catalog_subcategories roblox_catalog_subcategories_category_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."roblox_catalog_subcategories"
    ADD CONSTRAINT "roblox_catalog_subcategories_category_fkey" FOREIGN KEY ("category") REFERENCES "public"."roblox_catalog_categories"("category") ON DELETE CASCADE;


--
-- Name: roblox_universe_badges roblox_universe_badges_universe_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."roblox_universe_badges"
    ADD CONSTRAINT "roblox_universe_badges_universe_id_fkey" FOREIGN KEY ("universe_id") REFERENCES "public"."roblox_universes"("universe_id") ON DELETE CASCADE;


--
-- Name: roblox_universe_gamepasses roblox_universe_gamepasses_universe_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."roblox_universe_gamepasses"
    ADD CONSTRAINT "roblox_universe_gamepasses_universe_id_fkey" FOREIGN KEY ("universe_id") REFERENCES "public"."roblox_universes"("universe_id") ON DELETE CASCADE;


--
-- Name: roblox_universe_media roblox_universe_media_universe_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."roblox_universe_media"
    ADD CONSTRAINT "roblox_universe_media_universe_id_fkey" FOREIGN KEY ("universe_id") REFERENCES "public"."roblox_universes"("universe_id") ON DELETE CASCADE;


--
-- Name: roblox_universe_place_servers roblox_universe_place_servers_universe_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."roblox_universe_place_servers"
    ADD CONSTRAINT "roblox_universe_place_servers_universe_id_fkey" FOREIGN KEY ("universe_id") REFERENCES "public"."roblox_universes"("universe_id") ON DELETE CASCADE;


--
-- Name: roblox_universe_search_snapshots roblox_universe_search_snapshots_universe_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."roblox_universe_search_snapshots"
    ADD CONSTRAINT "roblox_universe_search_snapshots_universe_id_fkey" FOREIGN KEY ("universe_id") REFERENCES "public"."roblox_universes"("universe_id") ON DELETE CASCADE;


--
-- Name: roblox_universe_social_links roblox_universe_social_links_universe_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."roblox_universe_social_links"
    ADD CONSTRAINT "roblox_universe_social_links_universe_id_fkey" FOREIGN KEY ("universe_id") REFERENCES "public"."roblox_universes"("universe_id") ON DELETE CASCADE;


--
-- Name: roblox_universe_sort_entries roblox_universe_sort_entries_run_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."roblox_universe_sort_entries"
    ADD CONSTRAINT "roblox_universe_sort_entries_run_id_fkey" FOREIGN KEY ("run_id") REFERENCES "public"."roblox_universe_sort_runs"("id") ON DELETE CASCADE;


--
-- Name: roblox_universe_sort_entries roblox_universe_sort_entries_sort_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."roblox_universe_sort_entries"
    ADD CONSTRAINT "roblox_universe_sort_entries_sort_id_fkey" FOREIGN KEY ("sort_id") REFERENCES "public"."roblox_universe_sort_definitions"("sort_id") ON DELETE CASCADE;


--
-- Name: roblox_universe_sort_entries roblox_universe_sort_entries_universe_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."roblox_universe_sort_entries"
    ADD CONSTRAINT "roblox_universe_sort_entries_universe_id_fkey" FOREIGN KEY ("universe_id") REFERENCES "public"."roblox_universes"("universe_id") ON DELETE CASCADE;


--
-- Name: roblox_universe_stats_daily roblox_universe_stats_daily_universe_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."roblox_universe_stats_daily"
    ADD CONSTRAINT "roblox_universe_stats_daily_universe_id_fkey" FOREIGN KEY ("universe_id") REFERENCES "public"."roblox_universes"("universe_id") ON DELETE CASCADE;


--
-- Name: roblox_virtual_event_categories roblox_virtual_event_categories_event_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."roblox_virtual_event_categories"
    ADD CONSTRAINT "roblox_virtual_event_categories_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "public"."roblox_virtual_events"("event_id") ON DELETE CASCADE;


--
-- Name: roblox_virtual_event_thumbnails roblox_virtual_event_thumbnails_event_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."roblox_virtual_event_thumbnails"
    ADD CONSTRAINT "roblox_virtual_event_thumbnails_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "public"."roblox_virtual_events"("event_id") ON DELETE CASCADE;


--
-- Name: roblox_virtual_events roblox_virtual_events_universe_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."roblox_virtual_events"
    ADD CONSTRAINT "roblox_virtual_events_universe_id_fkey" FOREIGN KEY ("universe_id") REFERENCES "public"."roblox_universes"("universe_id") ON DELETE RESTRICT;


--
-- Name: tools tools_universe_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."tools"
    ADD CONSTRAINT "tools_universe_id_fkey" FOREIGN KEY ("universe_id") REFERENCES "public"."roblox_universes"("universe_id") ON DELETE SET NULL;


--
-- Name: user_checklist_progress user_checklist_progress_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."user_checklist_progress"
    ADD CONSTRAINT "user_checklist_progress_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."app_users"("user_id") ON DELETE CASCADE;


--
-- Name: user_code_progress user_code_progress_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."user_code_progress"
    ADD CONSTRAINT "user_code_progress_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."app_users"("user_id") ON DELETE CASCADE;


--
-- Name: user_quiz_progress user_quiz_progress_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."user_quiz_progress"
    ADD CONSTRAINT "user_quiz_progress_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."app_users"("user_id") ON DELETE CASCADE;


--
-- Name: wiki_pages wiki_pages_universe_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."wiki_pages"
    ADD CONSTRAINT "wiki_pages_universe_id_fkey" FOREIGN KEY ("universe_id") REFERENCES "public"."roblox_universes"("universe_id") ON DELETE SET NULL;


--
-- Name: app_sessions; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE "public"."app_sessions" ENABLE ROW LEVEL SECURITY;

--
-- Name: app_users; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE "public"."app_users" ENABLE ROW LEVEL SECURITY;

--
-- Name: app_users app_users_insert_self; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "app_users_insert_self" ON "public"."app_users" FOR INSERT WITH CHECK ((("auth"."uid"() = "user_id") AND ("role" = 'user'::"text")));


--
-- Name: app_users app_users_read_self; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "app_users_read_self" ON "public"."app_users" FOR SELECT USING (("auth"."uid"() = "user_id"));


--
-- Name: app_users app_users_update_self; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "app_users_update_self" ON "public"."app_users" FOR UPDATE USING (("auth"."uid"() = "user_id")) WITH CHECK ((("auth"."uid"() = "user_id") AND ("role" = 'user'::"text")));


--
-- Name: article_generation_artifacts; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE "public"."article_generation_artifacts" ENABLE ROW LEVEL SECURITY;

--
-- Name: article_generation_queue; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE "public"."article_generation_queue" ENABLE ROW LEVEL SECURITY;

--
-- Name: article_source_images; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE "public"."article_source_images" ENABLE ROW LEVEL SECURITY;

--
-- Name: articles; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE "public"."articles" ENABLE ROW LEVEL SECURITY;

--
-- Name: authors; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE "public"."authors" ENABLE ROW LEVEL SECURITY;

--
-- Name: catalog_pages; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE "public"."catalog_pages" ENABLE ROW LEVEL SECURITY;

--
-- Name: checklist_items; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE "public"."checklist_items" ENABLE ROW LEVEL SECURITY;

--
-- Name: checklist_pages; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE "public"."checklist_pages" ENABLE ROW LEVEL SECURITY;

--
-- Name: codes; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE "public"."codes" ENABLE ROW LEVEL SECURITY;

--
-- Name: comments; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE "public"."comments" ENABLE ROW LEVEL SECURITY;

--
-- Name: comments comments_insert_authenticated; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "comments_insert_authenticated" ON "public"."comments" FOR INSERT WITH CHECK ((("auth"."uid"() = "author_id") AND ("status" = 'pending'::"text") AND ("moderation" IS NULL)));


--
-- Name: comments comments_insert_guest; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "comments_insert_guest" ON "public"."comments" FOR INSERT WITH CHECK ((("auth"."uid"() IS NULL) AND ("author_id" IS NULL) AND ("guest_name" IS NOT NULL) AND ("length"(TRIM(BOTH FROM "guest_name")) >= 2) AND ("guest_email" IS NOT NULL) AND (POSITION(('@'::"text") IN ("guest_email")) > 1) AND ("status" = 'pending'::"text") AND ("moderation" IS NULL)));


--
-- Name: comments comments_select_public; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "comments_select_public" ON "public"."comments" FOR SELECT USING ((("status" = 'approved'::"text") OR ("author_id" = "auth"."uid"())));


--
-- Name: event_guide_generation_queue; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE "public"."event_guide_generation_queue" ENABLE ROW LEVEL SECURITY;

--
-- Name: events_pages; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE "public"."events_pages" ENABLE ROW LEVEL SECURITY;

--
-- Name: game_generation_queue; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE "public"."game_generation_queue" ENABLE ROW LEVEL SECURITY;

--
-- Name: game_list_entries; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE "public"."game_list_entries" ENABLE ROW LEVEL SECURITY;

--
-- Name: game_lists; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE "public"."game_lists" ENABLE ROW LEVEL SECURITY;

--
-- Name: games; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE "public"."games" ENABLE ROW LEVEL SECURITY;

--
-- Name: quiz_pages; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE "public"."quiz_pages" ENABLE ROW LEVEL SECURITY;

--
-- Name: quiz_pages quiz_pages_admin_full_access; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "quiz_pages_admin_full_access" ON "public"."quiz_pages" TO "authenticated" USING ("public"."is_admin"("auth"."uid"())) WITH CHECK ("public"."is_admin"("auth"."uid"()));


--
-- Name: quiz_pages quiz_pages_public_read; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "quiz_pages_public_read" ON "public"."quiz_pages" FOR SELECT TO "authenticated", "anon" USING (("is_published" = true));


--
-- Name: revalidation_events; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE "public"."revalidation_events" ENABLE ROW LEVEL SECURITY;

--
-- Name: roblox_catalog_categories; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE "public"."roblox_catalog_categories" ENABLE ROW LEVEL SECURITY;

--
-- Name: roblox_catalog_discovery_hits; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE "public"."roblox_catalog_discovery_hits" ENABLE ROW LEVEL SECURITY;

--
-- Name: roblox_catalog_discovery_runs; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE "public"."roblox_catalog_discovery_runs" ENABLE ROW LEVEL SECURITY;

--
-- Name: roblox_catalog_item_images; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE "public"."roblox_catalog_item_images" ENABLE ROW LEVEL SECURITY;

--
-- Name: roblox_catalog_items; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE "public"."roblox_catalog_items" ENABLE ROW LEVEL SECURITY;

--
-- Name: roblox_catalog_items_history; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE "public"."roblox_catalog_items_history" ENABLE ROW LEVEL SECURITY;

--
-- Name: roblox_catalog_refresh_queue; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE "public"."roblox_catalog_refresh_queue" ENABLE ROW LEVEL SECURITY;

--
-- Name: roblox_catalog_subcategories; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE "public"."roblox_catalog_subcategories" ENABLE ROW LEVEL SECURITY;

--
-- Name: roblox_groups; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE "public"."roblox_groups" ENABLE ROW LEVEL SECURITY;

--
-- Name: roblox_music_ids; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE "public"."roblox_music_ids" ENABLE ROW LEVEL SECURITY;

--
-- Name: roblox_universe_badges; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE "public"."roblox_universe_badges" ENABLE ROW LEVEL SECURITY;

--
-- Name: roblox_universe_gamepasses; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE "public"."roblox_universe_gamepasses" ENABLE ROW LEVEL SECURITY;

--
-- Name: roblox_universe_media; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE "public"."roblox_universe_media" ENABLE ROW LEVEL SECURITY;

--
-- Name: roblox_universe_place_servers; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE "public"."roblox_universe_place_servers" ENABLE ROW LEVEL SECURITY;

--
-- Name: roblox_universe_search_snapshots; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE "public"."roblox_universe_search_snapshots" ENABLE ROW LEVEL SECURITY;

--
-- Name: roblox_universe_social_links; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE "public"."roblox_universe_social_links" ENABLE ROW LEVEL SECURITY;

--
-- Name: roblox_universe_sort_definitions; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE "public"."roblox_universe_sort_definitions" ENABLE ROW LEVEL SECURITY;

--
-- Name: roblox_universe_sort_entries; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE "public"."roblox_universe_sort_entries" ENABLE ROW LEVEL SECURITY;

--
-- Name: roblox_universe_sort_runs; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE "public"."roblox_universe_sort_runs" ENABLE ROW LEVEL SECURITY;

--
-- Name: roblox_universe_stats_daily; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE "public"."roblox_universe_stats_daily" ENABLE ROW LEVEL SECURITY;

--
-- Name: roblox_universes; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE "public"."roblox_universes" ENABLE ROW LEVEL SECURITY;

--
-- Name: roblox_virtual_event_categories; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE "public"."roblox_virtual_event_categories" ENABLE ROW LEVEL SECURITY;

--
-- Name: roblox_virtual_event_thumbnails; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE "public"."roblox_virtual_event_thumbnails" ENABLE ROW LEVEL SECURITY;

--
-- Name: roblox_virtual_events; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE "public"."roblox_virtual_events" ENABLE ROW LEVEL SECURITY;

--
-- Name: search_index; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE "public"."search_index" ENABLE ROW LEVEL SECURITY;

--
-- Name: tools; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE "public"."tools" ENABLE ROW LEVEL SECURITY;

--
-- Name: user_checklist_progress; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE "public"."user_checklist_progress" ENABLE ROW LEVEL SECURITY;

--
-- Name: user_checklist_progress user_checklist_progress_delete_own; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "user_checklist_progress_delete_own" ON "public"."user_checklist_progress" FOR DELETE USING (("auth"."uid"() = "user_id"));


--
-- Name: user_checklist_progress user_checklist_progress_insert_own; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "user_checklist_progress_insert_own" ON "public"."user_checklist_progress" FOR INSERT WITH CHECK (("auth"."uid"() = "user_id"));


--
-- Name: user_checklist_progress user_checklist_progress_select_own; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "user_checklist_progress_select_own" ON "public"."user_checklist_progress" FOR SELECT USING (("auth"."uid"() = "user_id"));


--
-- Name: user_checklist_progress user_checklist_progress_update_own; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "user_checklist_progress_update_own" ON "public"."user_checklist_progress" FOR UPDATE USING (("auth"."uid"() = "user_id")) WITH CHECK (("auth"."uid"() = "user_id"));


--
-- Name: user_code_progress; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE "public"."user_code_progress" ENABLE ROW LEVEL SECURITY;

--
-- Name: user_code_progress user_code_progress_delete_own; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "user_code_progress_delete_own" ON "public"."user_code_progress" FOR DELETE USING (("auth"."uid"() = "user_id"));


--
-- Name: user_code_progress user_code_progress_insert_own; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "user_code_progress_insert_own" ON "public"."user_code_progress" FOR INSERT WITH CHECK (("auth"."uid"() = "user_id"));


--
-- Name: user_code_progress user_code_progress_select_own; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "user_code_progress_select_own" ON "public"."user_code_progress" FOR SELECT USING (("auth"."uid"() = "user_id"));


--
-- Name: user_code_progress user_code_progress_update_own; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "user_code_progress_update_own" ON "public"."user_code_progress" FOR UPDATE USING (("auth"."uid"() = "user_id")) WITH CHECK (("auth"."uid"() = "user_id"));


--
-- Name: user_quiz_progress; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE "public"."user_quiz_progress" ENABLE ROW LEVEL SECURITY;

--
-- Name: user_quiz_progress user_quiz_progress_delete_own; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "user_quiz_progress_delete_own" ON "public"."user_quiz_progress" FOR DELETE USING (("auth"."uid"() = "user_id"));


--
-- Name: user_quiz_progress user_quiz_progress_insert_own; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "user_quiz_progress_insert_own" ON "public"."user_quiz_progress" FOR INSERT WITH CHECK (("auth"."uid"() = "user_id"));


--
-- Name: user_quiz_progress user_quiz_progress_select_own; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "user_quiz_progress_select_own" ON "public"."user_quiz_progress" FOR SELECT USING (("auth"."uid"() = "user_id"));


--
-- Name: user_quiz_progress user_quiz_progress_update_own; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "user_quiz_progress_update_own" ON "public"."user_quiz_progress" FOR UPDATE USING (("auth"."uid"() = "user_id")) WITH CHECK (("auth"."uid"() = "user_id"));


--
-- PostgreSQL database dump complete
--

