


SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;


CREATE SCHEMA IF NOT EXISTS "extensions";


ALTER SCHEMA "extensions" OWNER TO "postgres";


CREATE SCHEMA IF NOT EXISTS "public";


ALTER SCHEMA "public" OWNER TO "pg_database_owner";


COMMENT ON SCHEMA "public" IS 'standard public schema';



CREATE OR REPLACE FUNCTION "extensions"."grant_pg_cron_access"() RETURNS "event_trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  IF EXISTS (
    SELECT
    FROM pg_event_trigger_ddl_commands() AS ev
    JOIN pg_extension AS ext
    ON ev.objid = ext.oid
    WHERE ext.extname = 'pg_cron'
  )
  THEN
    grant usage on schema cron to postgres with grant option;

    alter default privileges in schema cron grant all on tables to postgres with grant option;
    alter default privileges in schema cron grant all on functions to postgres with grant option;
    alter default privileges in schema cron grant all on sequences to postgres with grant option;

    alter default privileges for user supabase_admin in schema cron grant all
        on sequences to postgres with grant option;
    alter default privileges for user supabase_admin in schema cron grant all
        on tables to postgres with grant option;
    alter default privileges for user supabase_admin in schema cron grant all
        on functions to postgres with grant option;

    grant all privileges on all tables in schema cron to postgres with grant option;
    revoke all on table cron.job from postgres;
    grant select on table cron.job to postgres with grant option;
  END IF;
END;
$$;


ALTER FUNCTION "extensions"."grant_pg_cron_access"() OWNER TO "supabase_admin";


COMMENT ON FUNCTION "extensions"."grant_pg_cron_access"() IS 'Grants access to pg_cron';



CREATE OR REPLACE FUNCTION "extensions"."grant_pg_graphql_access"() RETURNS "event_trigger"
    LANGUAGE "plpgsql"
    AS $_$
DECLARE
    func_is_graphql_resolve bool;
BEGIN
    func_is_graphql_resolve = (
        SELECT n.proname = 'resolve'
        FROM pg_event_trigger_ddl_commands() AS ev
        LEFT JOIN pg_catalog.pg_proc AS n
        ON ev.objid = n.oid
    );

    IF func_is_graphql_resolve
    THEN
        -- Update public wrapper to pass all arguments through to the pg_graphql resolve func
        DROP FUNCTION IF EXISTS graphql_public.graphql;
        create or replace function graphql_public.graphql(
            "operationName" text default null,
            query text default null,
            variables jsonb default null,
            extensions jsonb default null
        )
            returns jsonb
            language sql
        as $$
            select graphql.resolve(
                query := query,
                variables := coalesce(variables, '{}'),
                "operationName" := "operationName",
                extensions := extensions
            );
        $$;

        -- This hook executes when `graphql.resolve` is created. That is not necessarily the last
        -- function in the extension so we need to grant permissions on existing entities AND
        -- update default permissions to any others that are created after `graphql.resolve`
        grant usage on schema graphql to postgres, anon, authenticated, service_role;
        grant select on all tables in schema graphql to postgres, anon, authenticated, service_role;
        grant execute on all functions in schema graphql to postgres, anon, authenticated, service_role;
        grant all on all sequences in schema graphql to postgres, anon, authenticated, service_role;
        alter default privileges in schema graphql grant all on tables to postgres, anon, authenticated, service_role;
        alter default privileges in schema graphql grant all on functions to postgres, anon, authenticated, service_role;
        alter default privileges in schema graphql grant all on sequences to postgres, anon, authenticated, service_role;

        -- Allow postgres role to allow granting usage on graphql and graphql_public schemas to custom roles
        grant usage on schema graphql_public to postgres with grant option;
        grant usage on schema graphql to postgres with grant option;
    END IF;

END;
$_$;


ALTER FUNCTION "extensions"."grant_pg_graphql_access"() OWNER TO "supabase_admin";


COMMENT ON FUNCTION "extensions"."grant_pg_graphql_access"() IS 'Grants access to pg_graphql';



CREATE OR REPLACE FUNCTION "extensions"."grant_pg_net_access"() RETURNS "event_trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_event_trigger_ddl_commands() AS ev
    JOIN pg_extension AS ext
    ON ev.objid = ext.oid
    WHERE ext.extname = 'pg_net'
  )
  THEN
    IF NOT EXISTS (
      SELECT 1
      FROM pg_roles
      WHERE rolname = 'supabase_functions_admin'
    )
    THEN
      CREATE USER supabase_functions_admin NOINHERIT CREATEROLE LOGIN NOREPLICATION;
    END IF;

    GRANT USAGE ON SCHEMA net TO supabase_functions_admin, postgres, anon, authenticated, service_role;

    IF EXISTS (
      SELECT FROM pg_extension
      WHERE extname = 'pg_net'
      -- all versions in use on existing projects as of 2025-02-20
      -- version 0.12.0 onwards don't need these applied
      AND extversion IN ('0.2', '0.6', '0.7', '0.7.1', '0.8', '0.10.0', '0.11.0')
    ) THEN
      ALTER function net.http_get(url text, params jsonb, headers jsonb, timeout_milliseconds integer) SECURITY DEFINER;
      ALTER function net.http_post(url text, body jsonb, params jsonb, headers jsonb, timeout_milliseconds integer) SECURITY DEFINER;

      ALTER function net.http_get(url text, params jsonb, headers jsonb, timeout_milliseconds integer) SET search_path = net;
      ALTER function net.http_post(url text, body jsonb, params jsonb, headers jsonb, timeout_milliseconds integer) SET search_path = net;

      REVOKE ALL ON FUNCTION net.http_get(url text, params jsonb, headers jsonb, timeout_milliseconds integer) FROM PUBLIC;
      REVOKE ALL ON FUNCTION net.http_post(url text, body jsonb, params jsonb, headers jsonb, timeout_milliseconds integer) FROM PUBLIC;

      GRANT EXECUTE ON FUNCTION net.http_get(url text, params jsonb, headers jsonb, timeout_milliseconds integer) TO supabase_functions_admin, postgres, anon, authenticated, service_role;
      GRANT EXECUTE ON FUNCTION net.http_post(url text, body jsonb, params jsonb, headers jsonb, timeout_milliseconds integer) TO supabase_functions_admin, postgres, anon, authenticated, service_role;
    END IF;
  END IF;
END;
$$;


ALTER FUNCTION "extensions"."grant_pg_net_access"() OWNER TO "supabase_admin";


COMMENT ON FUNCTION "extensions"."grant_pg_net_access"() IS 'Grants access to pg_net';



CREATE OR REPLACE FUNCTION "extensions"."pgrst_ddl_watch"() RETURNS "event_trigger"
    LANGUAGE "plpgsql"
    AS $$
DECLARE
  cmd record;
BEGIN
  FOR cmd IN SELECT * FROM pg_event_trigger_ddl_commands()
  LOOP
    IF cmd.command_tag IN (
      'CREATE SCHEMA', 'ALTER SCHEMA'
    , 'CREATE TABLE', 'CREATE TABLE AS', 'SELECT INTO', 'ALTER TABLE'
    , 'CREATE FOREIGN TABLE', 'ALTER FOREIGN TABLE'
    , 'CREATE VIEW', 'ALTER VIEW'
    , 'CREATE MATERIALIZED VIEW', 'ALTER MATERIALIZED VIEW'
    , 'CREATE FUNCTION', 'ALTER FUNCTION'
    , 'CREATE TRIGGER'
    , 'CREATE TYPE', 'ALTER TYPE'
    , 'CREATE RULE'
    , 'COMMENT'
    )
    -- don't notify in case of CREATE TEMP table or other objects created on pg_temp
    AND cmd.schema_name is distinct from 'pg_temp'
    THEN
      NOTIFY pgrst, 'reload schema';
    END IF;
  END LOOP;
END; $$;


ALTER FUNCTION "extensions"."pgrst_ddl_watch"() OWNER TO "supabase_admin";


CREATE OR REPLACE FUNCTION "extensions"."pgrst_drop_watch"() RETURNS "event_trigger"
    LANGUAGE "plpgsql"
    AS $$
DECLARE
  obj record;
BEGIN
  FOR obj IN SELECT * FROM pg_event_trigger_dropped_objects()
  LOOP
    IF obj.object_type IN (
      'schema'
    , 'table'
    , 'foreign table'
    , 'view'
    , 'materialized view'
    , 'function'
    , 'trigger'
    , 'type'
    , 'rule'
    )
    AND obj.is_temporary IS false -- no pg_temp objects
    THEN
      NOTIFY pgrst, 'reload schema';
    END IF;
  END LOOP;
END; $$;


ALTER FUNCTION "extensions"."pgrst_drop_watch"() OWNER TO "supabase_admin";


CREATE OR REPLACE FUNCTION "extensions"."set_graphql_placeholder"() RETURNS "event_trigger"
    LANGUAGE "plpgsql"
    AS $_$
    DECLARE
    graphql_is_dropped bool;
    BEGIN
    graphql_is_dropped = (
        SELECT ev.schema_name = 'graphql_public'
        FROM pg_event_trigger_dropped_objects() AS ev
        WHERE ev.schema_name = 'graphql_public'
    );

    IF graphql_is_dropped
    THEN
        create or replace function graphql_public.graphql(
            "operationName" text default null,
            query text default null,
            variables jsonb default null,
            extensions jsonb default null
        )
            returns jsonb
            language plpgsql
        as $$
            DECLARE
                server_version float;
            BEGIN
                server_version = (SELECT (SPLIT_PART((select version()), ' ', 2))::float);

                IF server_version >= 14 THEN
                    RETURN jsonb_build_object(
                        'errors', jsonb_build_array(
                            jsonb_build_object(
                                'message', 'pg_graphql extension is not enabled.'
                            )
                        )
                    );
                ELSE
                    RETURN jsonb_build_object(
                        'errors', jsonb_build_array(
                            jsonb_build_object(
                                'message', 'pg_graphql is only available on projects running Postgres 14 onwards.'
                            )
                        )
                    );
                END IF;
            END;
        $$;
    END IF;

    END;
$_$;


ALTER FUNCTION "extensions"."set_graphql_placeholder"() OWNER TO "supabase_admin";


COMMENT ON FUNCTION "extensions"."set_graphql_placeholder"() IS 'Reintroduces placeholder function for graphql_public.graphql';



CREATE OR REPLACE FUNCTION "public"."article_generation_queue_idempotency_key"("title" "text", "universe_id" bigint) RETURNS "text"
    LANGUAGE "sql" IMMUTABLE
    AS $$
  select case
    when nullif(trim(both '-' from regexp_replace(lower(coalesce(title, '')), '[^a-z0-9]+', '-', 'g')), '') is null
      then null
    else coalesce(universe_id::text, 'global') || ':' ||
      trim(both '-' from regexp_replace(lower(coalesce(title, '')), '[^a-z0-9]+', '-', 'g'))
  end;
$$;


ALTER FUNCTION "public"."article_generation_queue_idempotency_key"("title" "text", "universe_id" bigint) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."avatar_catalog_slugs_for_catalog_item"("p_category" "text", "p_subcategory" "text", "p_asset_type_id" integer) RETURNS "text"[]
    LANGUAGE "plpgsql" IMMUTABLE
    AS $$
declare
  v_category text := coalesce(p_category, '');
  v_subcategory text := coalesce(p_subcategory, '');
  v_slugs text[] := array[]::text[];
begin
  if v_category in ('Accessories', 'Body', 'Clothing', 'AvatarAnimations', 'Makeup')
    or p_asset_type_id = any(array[76, 77, 88, 89, 90]::integer[])
  then
    v_slugs := array_append(v_slugs, 'roblox-items-and-bundles');
  end if;

  if v_category = 'Accessories' then
    v_slugs := array_append(v_slugs, 'roblox-items-and-bundles/roblox-accessories');
    case v_subcategory
      when 'HeadAccessories' then v_slugs := array_append(v_slugs, 'roblox-items-and-bundles/roblox-accessories/head-accessories');
      when 'FaceAccessories' then v_slugs := array_append(v_slugs, 'roblox-items-and-bundles/roblox-accessories/face-accessories');
      when 'NeckAccessories' then v_slugs := array_append(v_slugs, 'roblox-items-and-bundles/roblox-accessories/neck-accessories');
      when 'ShoulderAccessories' then v_slugs := array_append(v_slugs, 'roblox-items-and-bundles/roblox-accessories/shoulder-accessories');
      when 'FrontAccessories' then v_slugs := array_append(v_slugs, 'roblox-items-and-bundles/roblox-accessories/front-accessories');
      when 'BackAccessories' then v_slugs := array_append(v_slugs, 'roblox-items-and-bundles/roblox-accessories/back-accessories');
      when 'WaistAccessories' then v_slugs := array_append(v_slugs, 'roblox-items-and-bundles/roblox-accessories/waist-accessories');
      when 'Gear' then v_slugs := array_append(v_slugs, 'roblox-items-and-bundles/roblox-accessories/gear');
      else null;
    end case;
  end if;

  if v_category = 'Body' and v_subcategory = 'HairAccessories' then
    v_slugs := array_append(v_slugs, 'roblox-items-and-bundles/roblox-accessories');
    v_slugs := array_append(v_slugs, 'roblox-items-and-bundles/roblox-accessories/hair-accessories');
  elsif v_category = 'Body' then
    v_slugs := array_append(v_slugs, 'roblox-items-and-bundles/roblox-body-parts');
    case v_subcategory
      when 'BodyPartsBundles' then v_slugs := array_append(v_slugs, 'roblox-items-and-bundles/roblox-body-parts/full-bodies');
      when 'DynamicHeads' then v_slugs := array_append(v_slugs, 'roblox-items-and-bundles/roblox-body-parts/dynamic-heads');
      when 'Heads' then v_slugs := array_append(v_slugs, 'roblox-items-and-bundles/roblox-body-parts/classic-heads');
      when 'Faces' then v_slugs := array_append(v_slugs, 'roblox-items-and-bundles/roblox-body-parts/classic-faces');
      else null;
    end case;
  end if;

  if v_category = 'Clothing' then
    v_slugs := array_append(v_slugs, 'roblox-items-and-bundles/roblox-clothing');
    case v_subcategory
      when 'TShirtAccessories' then v_slugs := array_append(v_slugs, 'roblox-items-and-bundles/roblox-clothing/layered-t-shirts');
      when 'ShirtAccessories' then v_slugs := array_append(v_slugs, 'roblox-items-and-bundles/roblox-clothing/shirts');
      when 'SweaterAccessories' then v_slugs := array_append(v_slugs, 'roblox-items-and-bundles/roblox-clothing/sweaters');
      when 'JacketAccessories' then v_slugs := array_append(v_slugs, 'roblox-items-and-bundles/roblox-clothing/jackets');
      when 'PantsAccessories' then v_slugs := array_append(v_slugs, 'roblox-items-and-bundles/roblox-clothing/pants');
      when 'ShortsAccessories' then v_slugs := array_append(v_slugs, 'roblox-items-and-bundles/roblox-clothing/shorts');
      when 'DressSkirtAccessories' then v_slugs := array_append(v_slugs, 'roblox-items-and-bundles/roblox-clothing/dresses-skirts');
      when 'ShoesBundles' then v_slugs := array_append(v_slugs, 'roblox-items-and-bundles/roblox-clothing/shoes');
      when 'ClassicShirts' then v_slugs := array_append(v_slugs, 'roblox-items-and-bundles/roblox-clothing/classic-shirts');
      when 'ClassicTShirts' then v_slugs := array_append(v_slugs, 'roblox-items-and-bundles/roblox-clothing/classic-t-shirts');
      when 'ClassicPants' then v_slugs := array_append(v_slugs, 'roblox-items-and-bundles/roblox-clothing/classic-pants');
      else null;
    end case;
  end if;

  if v_category = 'AvatarAnimations' then
    case v_subcategory
      when 'EmoteAnimations' then v_slugs := array_append(v_slugs, 'roblox-items-and-bundles/roblox-emotes');
      when 'AnimationBundles' then v_slugs := array_append(v_slugs, 'roblox-items-and-bundles/roblox-animations');
      else null;
    end case;
  end if;

  if v_category = 'Makeup' or p_asset_type_id = any(array[76, 77, 88, 89, 90]::integer[]) then
    v_slugs := array_append(v_slugs, 'roblox-items-and-bundles/roblox-makeup');
  end if;

  return array(
    select distinct slug
    from unnest(v_slugs) as slug
    where slug is not null and slug <> ''
  );
end;
$$;


ALTER FUNCTION "public"."avatar_catalog_slugs_for_catalog_item"("p_category" "text", "p_subcategory" "text", "p_asset_type_id" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."calculate_roblox_rating_percent"("p_likes" bigint, "p_dislikes" bigint) RETURNS numeric
    LANGUAGE "sql" IMMUTABLE
    AS $$
  select case
    when coalesce(p_likes, 0) + coalesce(p_dislikes, 0) <= 0 then null
    else round((coalesce(p_likes, 0)::numeric / (coalesce(p_likes, 0) + coalesce(p_dislikes, 0))::numeric) * 100, 2)
  end;
$$;


ALTER FUNCTION "public"."calculate_roblox_rating_percent"("p_likes" bigint, "p_dislikes" bigint) OWNER TO "postgres";

SET default_tablespace = '';

SET default_table_access_method = "heap";


CREATE TABLE IF NOT EXISTS "public"."article_generation_queue" (
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


ALTER TABLE "public"."article_generation_queue" OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."claim_article_generation_queue_item"("p_queue_id" "uuid" DEFAULT NULL::"uuid", "p_worker_id" "text" DEFAULT NULL::"text", "p_max_attempts" integer DEFAULT 3) RETURNS "public"."article_generation_queue"
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


ALTER FUNCTION "public"."claim_article_generation_queue_item"("p_queue_id" "uuid", "p_worker_id" "text", "p_max_attempts" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."enqueue_author_revalidation_for_author_id"("p_author_id" "uuid", "p_source" "text") RETURNS "void"
    LANGUAGE "plpgsql"
    AS $$
begin
  if p_author_id is null then
    return;
  end if;

  insert into public.revalidation_events (entity_type, slug, source)
  select distinct 'author', lower(a.slug), p_source
  from public.authors a
  where a.id = p_author_id
    and a.slug is not null
    and trim(a.slug) <> ''
  on conflict (entity_type, slug)
  do update set
    created_at = now(),
    source = excluded.source;
end;
$$;


ALTER FUNCTION "public"."enqueue_author_revalidation_for_author_id"("p_author_id" "uuid", "p_source" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."enqueue_free_items_catalog_scope"("p_category" "text", "p_subcategory" "text", "p_source" "text") RETURNS "void"
    LANGUAGE "plpgsql"
    AS $$
declare
  category_slug text := public.revalidation_slugify(p_category);
  subcategory_slug text := public.revalidation_slugify(p_subcategory);
begin
  if category_slug is null then
    return;
  end if;

  perform public.enqueue_revalidation('catalog', 'free-roblox-items/' || category_slug, p_source);

  if subcategory_slug is not null then
    perform public.enqueue_revalidation(
      'catalog',
      'free-roblox-items/' || category_slug || '/' || subcategory_slug,
      p_source
    );
  end if;
end;
$$;


ALTER FUNCTION "public"."enqueue_free_items_catalog_scope"("p_category" "text", "p_subcategory" "text", "p_source" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."enqueue_music_revalidation_scope"("p_section" "text", "p_value" "text", "p_source" "text") RETURNS "void"
    LANGUAGE "plpgsql"
    AS $$
declare
  value_slug text := public.revalidation_slugify(p_value);
begin
  if value_slug is null then
    return;
  end if;

  if p_section = 'genres' then
    perform public.enqueue_revalidation('music', 'roblox-music-ids/genres/' || value_slug, p_source);
  elsif p_section = 'artists' then
    perform public.enqueue_revalidation('music', 'roblox-music-ids/artists/' || value_slug, p_source);
  end if;
end;
$$;


ALTER FUNCTION "public"."enqueue_music_revalidation_scope"("p_section" "text", "p_value" "text", "p_source" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."enqueue_revalidation"("p_entity_type" "text", "p_slug" "text", "p_source" "text" DEFAULT NULL::"text") RETURNS "void"
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


ALTER FUNCTION "public"."enqueue_revalidation"("p_entity_type" "text", "p_slug" "text", "p_source" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."enqueue_wiki_revalidation_for_universe"("p_universe_id" bigint, "p_source" "text") RETURNS "void"
    LANGUAGE "plpgsql"
    AS $$
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


ALTER FUNCTION "public"."enqueue_wiki_revalidation_for_universe"("p_universe_id" bigint, "p_source" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_items_needing_metrics_calculation"("p_limit" integer DEFAULT 100, "p_max_age_hours" integer DEFAULT 1) RETURNS TABLE("asset_id" bigint, "name" "text", "rap" bigint, "last_calculated" timestamp with time zone, "hours_since_calculation" numeric)
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


ALTER FUNCTION "public"."get_items_needing_metrics_calculation"("p_limit" integer, "p_max_age_hours" integer) OWNER TO "postgres";


COMMENT ON FUNCTION "public"."get_items_needing_metrics_calculation"("p_limit" integer, "p_max_age_hours" integer) IS 'Returns Limited items that need trading metrics calculated';



CREATE OR REPLACE FUNCTION "public"."get_items_needing_rap_update"("p_limit" integer DEFAULT 100, "p_max_age_hours" integer DEFAULT 12) RETURNS TABLE("asset_id" bigint, "name" "text", "last_fetched" timestamp with time zone, "hours_since_update" numeric)
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


ALTER FUNCTION "public"."get_items_needing_rap_update"("p_limit" integer, "p_max_age_hours" integer) OWNER TO "postgres";


COMMENT ON FUNCTION "public"."get_items_needing_rap_update"("p_limit" integer, "p_max_age_hours" integer) IS 'Returns Limited items that need RAP data updated';



CREATE OR REPLACE FUNCTION "public"."get_stats_platform_ccu_trend"("p_since" timestamp with time zone DEFAULT ("now"() - '24:00:00'::interval)) RETURNS TABLE("hour_start" timestamp with time zone, "players" bigint, "peak_players" bigint, "avg_players" numeric, "visits" bigint, "favorites" bigint, "rating" numeric, "samples" bigint)
    LANGUAGE "sql" STABLE
    SET "search_path" TO ''
    AS $$
  with hourly as (
    select
      h.hour_start,
      coalesce(h.avg_playing, h.playing::numeric) as avg_player_value,
      h.peak_playing,
      h.visits_end,
      h.favorites_end,
      h.rating_percent,
      greatest(h.sample_count, 1) as sample_count
    from public.roblox_universe_stats_hourly h
    inner join public.stats_game_current_index g
      on g.universe_id = h.universe_id
    where h.hour_start >= p_since
  )
  select
    h.hour_start,
    coalesce(round(sum(h.avg_player_value))::bigint, 0::bigint) as players,
    coalesce(sum(coalesce(h.peak_playing, 0))::bigint, 0::bigint) as peak_players,
    coalesce(sum(h.avg_player_value), 0::numeric) as avg_players,
    coalesce(sum(coalesce(h.visits_end, 0))::bigint, 0::bigint) as visits,
    coalesce(sum(coalesce(h.favorites_end, 0))::bigint, 0::bigint) as favorites,
    case
      when sum(h.sample_count) filter (where h.rating_percent is not null) > 0 then
        round(
          sum(h.rating_percent * h.sample_count) filter (where h.rating_percent is not null)
          / sum(h.sample_count) filter (where h.rating_percent is not null),
          1
        )
      else null
    end as rating,
    coalesce(sum(h.sample_count)::bigint, 0::bigint) as samples
  from hourly h
  group by h.hour_start
  order by h.hour_start asc;
$$;


ALTER FUNCTION "public"."get_stats_platform_ccu_trend"("p_since" timestamp with time zone) OWNER TO "supabase_admin";


CREATE OR REPLACE FUNCTION "public"."get_stats_platform_current_summary"() RETURNS TABLE("live_players" bigint, "total_visits" bigint, "fresh_games" integer, "last_updated_at" timestamp with time zone)
    LANGUAGE "sql" STABLE
    SET "search_path" TO ''
    AS $$
  select
    coalesce(sum(u.playing) filter (
      where u.last_playing_refreshed_at >= now() - interval '24 hours'
    ), 0)::bigint as live_players,
    coalesce(sum(u.visits), 0)::bigint as total_visits,
    count(*) filter (
      where u.playing is not null
        and u.last_playing_refreshed_at >= now() - interval '24 hours'
    )::integer as fresh_games,
    max(u.last_playing_refreshed_at) filter (
      where u.last_playing_refreshed_at >= now() - interval '24 hours'
    ) as last_updated_at
  from public.roblox_universes u
  where u.slug is not null;
$$;


ALTER FUNCTION "public"."get_stats_platform_current_summary"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_stats_subgenre_options"() RETURNS TABLE("genre" "text", "subgenre" "text", "games" integer, "playing" bigint)
    LANGUAGE "sql" STABLE
    SET "search_path" TO ''
    AS $$
  select
    btrim(genre_l1) as genre,
    btrim(genre_l2) as subgenre,
    count(*)::integer as games,
    coalesce(sum(playing), 0)::bigint as playing
  from public.stats_game_current_index
  where genre_l1 is not null
    and btrim(genre_l1) <> ''
    and lower(btrim(genre_l1)) not in ('all', 'uncategorized')
    and genre_l2 is not null
    and btrim(genre_l2) <> ''
    and lower(btrim(genre_l2)) not in ('all', 'uncategorized')
  group by btrim(genre_l1), btrim(genre_l2)
  order by btrim(genre_l1) asc, coalesce(sum(playing), 0) desc, btrim(genre_l2) asc;
$$;


ALTER FUNCTION "public"."get_stats_subgenre_options"() OWNER TO "supabase_admin";


CREATE OR REPLACE FUNCTION "public"."get_stats_visit_share_chart"("p_since" "date", "p_until" "date", "p_top_games" integer DEFAULT 8, "p_top_group" integer DEFAULT 100, "p_wide_group" integer DEFAULT 1000) RETURNS TABLE("stat_date" "date", "bucket_key" "text", "bucket_name" "text", "universe_id" bigint, "slug" "text", "icon_url" "text", "bucket_rank_start" integer, "bucket_rank_end" integer, "is_group" boolean, "visit_delta" bigint, "denominator_visit_delta" bigint, "denominator_game_count" integer)
    LANGUAGE "sql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
  with daily_source as (
    select
      d.universe_id,
      d.stat_date,
      greatest(
        coalesce(d.visit_delta, d.visits_end - d.visits_start, 0),
        0
      )::bigint as visit_delta
    from public.roblox_universe_stats_daily d
    where d.stat_date >= p_since
      and d.stat_date <= p_until
  ),
  positive_daily as (
    select *
    from daily_source
    where visit_delta > 0
  ),
  game_totals as (
    select
      universe_id,
      sum(visit_delta)::bigint as total_visits
    from positive_daily
    group by universe_id
  ),
  ranked_games as (
    select
      gt.universe_id,
      row_number() over (order by gt.total_visits desc, gt.universe_id asc)::integer as visit_rank,
      gt.total_visits,
      coalesce(nullif(u.display_name, ''), u.name) as game_name,
      u.slug,
      u.icon_url
    from game_totals gt
    left join public.roblox_universes u
      on u.universe_id = gt.universe_id
  ),
  daily_denominator as (
    select
      stat_date,
      sum(visit_delta)::bigint as denominator_visit_delta,
      count(distinct universe_id)::integer as denominator_game_count
    from positive_daily
    group by stat_date
  ),
  top_bucketed as (
    select
      d.stat_date,
      case
        when rg.visit_rank <= p_top_games then 'g' || rg.universe_id::text
        when rg.visit_rank <= p_top_group then 'rank_' || (p_top_games + 1)::text || '_' || p_top_group::text
        when rg.visit_rank <= p_wide_group then 'rank_' || (p_top_group + 1)::text || '_' || p_wide_group::text
      end as bucket_key,
      case
        when rg.visit_rank <= p_top_games then coalesce(rg.game_name, rg.universe_id::text)
        when rg.visit_rank <= p_top_group then 'Ranks ' || (p_top_games + 1)::text || '-' || p_top_group::text
        when rg.visit_rank <= p_wide_group then 'Ranks ' || (p_top_group + 1)::text || '-' || p_wide_group::text
      end as bucket_name,
      case when rg.visit_rank <= p_top_games then rg.universe_id else null end as universe_id,
      case when rg.visit_rank <= p_top_games then rg.slug else null end as slug,
      case when rg.visit_rank <= p_top_games then rg.icon_url else null end as icon_url,
      case
        when rg.visit_rank <= p_top_games then rg.visit_rank
        when rg.visit_rank <= p_top_group then p_top_games + 1
        when rg.visit_rank <= p_wide_group then p_top_group + 1
      end as bucket_rank_start,
      case
        when rg.visit_rank <= p_top_games then rg.visit_rank
        when rg.visit_rank <= p_top_group then p_top_group
        when rg.visit_rank <= p_wide_group then p_wide_group
      end as bucket_rank_end,
      rg.visit_rank > p_top_games as is_group,
      sum(d.visit_delta)::bigint as visit_delta
    from positive_daily d
    inner join ranked_games rg
      on rg.universe_id = d.universe_id
    where rg.visit_rank <= p_wide_group
    group by
      1,
      2,
      3,
      4,
      5,
      6,
      7,
      8,
      9
  ),
  top_totals_by_date as (
    select
      stat_date,
      sum(visit_delta)::bigint as top_visit_delta
    from top_bucketed
    group by stat_date
  ),
  other_bucket as (
    select
      dd.stat_date,
      'other_tracked'::text as bucket_key,
      'Other tracked games'::text as bucket_name,
      null::bigint as universe_id,
      null::text as slug,
      null::text as icon_url,
      p_wide_group + 1 as bucket_rank_start,
      dd.denominator_game_count as bucket_rank_end,
      true as is_group,
      greatest(dd.denominator_visit_delta - coalesce(tt.top_visit_delta, 0), 0)::bigint as visit_delta
    from daily_denominator dd
    left join top_totals_by_date tt
      on tt.stat_date = dd.stat_date
    where greatest(dd.denominator_visit_delta - coalesce(tt.top_visit_delta, 0), 0) > 0
  )
  select
    b.stat_date,
    b.bucket_key,
    b.bucket_name,
    b.universe_id,
    b.slug,
    b.icon_url,
    b.bucket_rank_start,
    b.bucket_rank_end,
    b.is_group,
    b.visit_delta,
    dd.denominator_visit_delta,
    dd.denominator_game_count
  from (
    select * from top_bucketed
    union all
    select * from other_bucket
  ) b
  inner join daily_denominator dd
    on dd.stat_date = b.stat_date
  order by
    b.stat_date asc,
    b.bucket_rank_start asc,
    b.bucket_rank_end asc,
    b.bucket_key asc;
$$;


ALTER FUNCTION "public"."get_stats_visit_share_chart"("p_since" "date", "p_until" "date", "p_top_games" integer, "p_top_group" integer, "p_wide_group" integer) OWNER TO "supabase_admin";


CREATE OR REPLACE FUNCTION "public"."invoke_cache_warm_worker"() RETURNS bigint
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'net', 'vault'
    AS $$
declare
  cache_warm_jwt text;
  request_id bigint;
begin
  select decrypted_secret
  into cache_warm_jwt
  from vault.decrypted_secrets
  where name = 'revalidate_cron_jwt'
  limit 1;

  if nullif(trim(coalesce(cache_warm_jwt, '')), '') is null then
    raise exception 'Missing Vault secret revalidate_cron_jwt for cache warm cron';
  end if;

  select net.http_post(
    url := 'https://bloxodesdb.ravitejaknts.com/functions/v1/cache-warm',
    body := '{}'::jsonb,
    params := '{}'::jsonb,
    headers := jsonb_build_object(
      'Authorization', 'Bearer ' || cache_warm_jwt,
      'apikey', cache_warm_jwt,
      'Content-Type', 'application/json'
    ),
    timeout_milliseconds := 60000
  )
  into request_id;

  return request_id;
end;
$$;


ALTER FUNCTION "public"."invoke_cache_warm_worker"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."invoke_revalidation_worker"() RETURNS bigint
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'net', 'vault'
    AS $$
declare
  revalidate_jwt text;
  request_id bigint;
begin
  select decrypted_secret
  into revalidate_jwt
  from vault.decrypted_secrets
  where name = 'revalidate_cron_jwt'
  limit 1;

  if nullif(trim(coalesce(revalidate_jwt, '')), '') is null then
    raise exception 'Missing Vault secret revalidate_cron_jwt for revalidation cron';
  end if;

  select net.http_post(
    url := 'https://database.bloxodes.com/functions/v1/revalidate',
    body := '{}'::jsonb,
    params := '{}'::jsonb,
    headers := jsonb_build_object(
      'Authorization', 'Bearer ' || revalidate_jwt,
      'apikey', revalidate_jwt,
      'Content-Type', 'application/json'
    ),
    timeout_milliseconds := 60000
  )
  into request_id;

  return request_id;
end;
$$;


ALTER FUNCTION "public"."invoke_revalidation_worker"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."is_admin"("user_uuid" "uuid") RETURNS boolean
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


ALTER FUNCTION "public"."is_admin"("user_uuid" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."normalize_section_code"("raw" "text") RETURNS "text"
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


ALTER FUNCTION "public"."normalize_section_code"("raw" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."percent_delta"("p_current" numeric, "p_previous" numeric) RETURNS numeric
    LANGUAGE "sql" IMMUTABLE
    AS $$
  select case
    when p_current is null or p_previous is null or p_previous <= 0 then null
    else round(((p_current - p_previous) / p_previous) * 1000) / 10
  end;
$$;


ALTER FUNCTION "public"."percent_delta"("p_current" numeric, "p_previous" numeric) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."prune_roblox_universe_hourly_history"("p_cutoff" timestamp with time zone, "p_batch_size" integer DEFAULT 5000) RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  stats_deleted integer := 0;
  rank_deleted integer := 0;
begin
  with doomed as (
    select ctid
    from public.roblox_universe_stats_hourly
    where hour_start < p_cutoff
    limit greatest(p_batch_size, 1)
  ),
  deleted as (
    delete from public.roblox_universe_stats_hourly h
    using doomed
    where h.ctid = doomed.ctid
    returning 1
  )
  select count(*) into stats_deleted from deleted;

  with doomed as (
    select ctid
    from public.roblox_universe_rank_snapshots_hourly
    where hour_start < p_cutoff
    limit greatest(p_batch_size, 1)
  ),
  deleted as (
    delete from public.roblox_universe_rank_snapshots_hourly h
    using doomed
    where h.ctid = doomed.ctid
    returning 1
  )
  select count(*) into rank_deleted from deleted;

  return jsonb_build_object(
    'stats_deleted', stats_deleted,
    'rank_deleted', rank_deleted,
    'cutoff', p_cutoff
  );
end;
$$;


ALTER FUNCTION "public"."prune_roblox_universe_hourly_history"("p_cutoff" timestamp with time zone, "p_batch_size" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."qualifies_for_free_items_catalog"("p_price_robux" bigint, "p_is_deleted" boolean, "p_is_for_sale" boolean, "p_has_resellers" boolean, "p_lowest_resale_price_robux" bigint, "p_name" "text", "p_category" "text", "p_subcategory" "text", "p_favorite_count" bigint, "p_free_claimability" "text", "p_free_verified_at" timestamp with time zone, "p_free_verification_source" "text") RETURNS boolean
    LANGUAGE "sql" IMMUTABLE
    AS $$
  select coalesce(
    p_price_robux = 0
    and p_is_deleted = false
    and p_is_for_sale = true
    and p_has_resellers = false
    and p_lowest_resale_price_robux = 0
    and p_name is not null
    and p_category is not null
    and p_subcategory is not null
    and p_favorite_count is not null
    and p_free_claimability = 'direct'
    and p_free_verified_at is not null
    and p_free_verification_source = 'roblox',
    false
  );
$$;


ALTER FUNCTION "public"."qualifies_for_free_items_catalog"("p_price_robux" bigint, "p_is_deleted" boolean, "p_is_for_sale" boolean, "p_has_resellers" boolean, "p_lowest_resale_price_robux" bigint, "p_name" "text", "p_category" "text", "p_subcategory" "text", "p_favorite_count" bigint, "p_free_claimability" "text", "p_free_verified_at" timestamp with time zone, "p_free_verification_source" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."record_stats_health_check"() RETURNS "uuid"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  run_id uuid;
  payload jsonb;
begin
  select jsonb_build_object(
    'checked_at', now(),
    'tier_counts', (
      select coalesce(jsonb_object_agg(stats_tier, count), '{}'::jsonb)
      from (
        select coalesce(stats_tier, 'UNKNOWN') as stats_tier, count(*)::integer as count
        from public.roblox_universes
        where root_place_id is not null
        group by coalesce(stats_tier, 'UNKNOWN')
      ) counts
    ),
    'stale', jsonb_build_object(
      'hot_over_90m', (
        select count(*)::integer
        from public.roblox_universes
        where root_place_id is not null
          and stats_tier = 'HOT'
          and (last_stats_refreshed_at is null or last_stats_refreshed_at < now() - interval '90 minutes')
      ),
      'warm_over_14h', (
        select count(*)::integer
        from public.roblox_universes
        where root_place_id is not null
          and stats_tier = 'WARM'
          and (last_stats_refreshed_at is null or last_stats_refreshed_at < now() - interval '14 hours')
      ),
      'cold_over_7d', (
        select count(*)::integer
        from public.roblox_universes
        where root_place_id is not null
          and stats_tier = 'COLD'
          and (last_stats_refreshed_at is null or last_stats_refreshed_at < now() - interval '7 days')
      ),
      'new_total', (
        select count(*)::integer
        from public.roblox_universes
        where root_place_id is not null
          and stats_tier = 'NEW'
      )
    ),
    'latest_hourly_sample', (
      select max(hour_start)
      from public.roblox_universe_stats_hourly
    ),
    'latest_hourly_rank', (
      select max(hour_start)
      from public.roblox_universe_rank_snapshots_hourly
    ),
    'latest_daily_rollup', (
      select max(stat_date)
      from public.roblox_universe_stats_daily
    ),
    'latest_daily_rank', (
      select max(stat_date)
      from public.roblox_universe_rank_snapshots_daily
    )
  )
  into payload;

  insert into public.stats_job_runs (
    job_name,
    worker_id,
    started_at,
    finished_at,
    status,
    metadata
  )
  values (
    'stats-health-check',
    'supabase-cron',
    now(),
    now(),
    'success',
    payload
  )
  returning id into run_id;

  return run_id;
end;
$$;


ALTER FUNCTION "public"."record_stats_health_check"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."refresh_roblox_promo_rewards"("p_seen_rows" "jsonb", "p_checked_at" timestamp with time zone, "p_retire_after_misses" integer, "p_touch_catalog" boolean) RETURNS "jsonb"
    LANGUAGE "plpgsql"
    SET "search_path" TO ''
    AS $$
declare
  v_seen_count bigint := 0;
  v_missing_updated bigint := 0;
  v_retired bigint := 0;
  v_catalog_touched bigint := 0;
begin
  if jsonb_typeof(p_seen_rows) is distinct from 'array' then
    raise exception 'p_seen_rows must be a JSON array';
  end if;
  if p_checked_at is null then
    raise exception 'p_checked_at is required';
  end if;
  if p_retire_after_misses is null or p_retire_after_misses < 2 then
    raise exception 'p_retire_after_misses must be at least 2';
  end if;

  select jsonb_array_length(p_seen_rows) into v_seen_count;
  if v_seen_count = 0 then
    raise exception 'p_seen_rows must not be empty';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(73724570123456789);

  insert into public.roblox_promo_rewards (
    source_provider,
    source_key,
    source_list_url,
    source_url,
    asset_id,
    roblox_item_type,
    reward_name,
    source_type,
    claim_type,
    promo_code,
    promo_code_normalized,
    event_name,
    requirement_text,
    claim_instructions,
    destination_url,
    roblox_item_url,
    official_name,
    asset_type_id,
    creator_id,
    creator_name,
    thumbnail_url,
    thumbnail_state,
    thumbnail_checked_at,
    status,
    status_reason,
    consecutive_misses,
    sort_order,
    source_hash,
    last_seen_at,
    last_checked_at,
    verified_at,
    retired_at,
    raw_source_json,
    raw_roblox_json
  )
  select
    input_row.source_provider,
    input_row.source_key,
    input_row.source_list_url,
    input_row.source_url,
    input_row.asset_id,
    input_row.roblox_item_type,
    input_row.reward_name,
    input_row.source_type,
    input_row.claim_type,
    input_row.promo_code,
    input_row.promo_code_normalized,
    input_row.event_name,
    input_row.requirement_text,
    input_row.claim_instructions,
    input_row.destination_url,
    input_row.roblox_item_url,
    input_row.official_name,
    input_row.asset_type_id,
    input_row.creator_id,
    input_row.creator_name,
    input_row.thumbnail_url,
    input_row.thumbnail_state,
    input_row.thumbnail_checked_at,
    input_row.status,
    input_row.status_reason,
    input_row.consecutive_misses,
    input_row.sort_order,
    input_row.source_hash,
    input_row.last_seen_at,
    input_row.last_checked_at,
    input_row.verified_at,
    input_row.retired_at,
    input_row.raw_source_json,
    input_row.raw_roblox_json
  from jsonb_to_recordset(p_seen_rows) as input_row (
    source_provider text,
    source_key text,
    source_list_url text,
    source_url text,
    asset_id bigint,
    roblox_item_type text,
    reward_name text,
    source_type text,
    claim_type text,
    promo_code text,
    promo_code_normalized text,
    event_name text,
    requirement_text text,
    claim_instructions text,
    destination_url text,
    roblox_item_url text,
    official_name text,
    asset_type_id integer,
    creator_id bigint,
    creator_name text,
    thumbnail_url text,
    thumbnail_state text,
    thumbnail_checked_at timestamptz,
    status text,
    status_reason text,
    consecutive_misses integer,
    sort_order integer,
    source_hash text,
    last_seen_at timestamptz,
    last_checked_at timestamptz,
    verified_at timestamptz,
    retired_at timestamptz,
    raw_source_json jsonb,
    raw_roblox_json jsonb
  )
  on conflict (source_provider, source_key) do update set
    source_list_url = excluded.source_list_url,
    source_url = excluded.source_url,
    asset_id = excluded.asset_id,
    roblox_item_type = excluded.roblox_item_type,
    reward_name = excluded.reward_name,
    source_type = excluded.source_type,
    claim_type = excluded.claim_type,
    promo_code = excluded.promo_code,
    promo_code_normalized = excluded.promo_code_normalized,
    event_name = excluded.event_name,
    requirement_text = excluded.requirement_text,
    claim_instructions = excluded.claim_instructions,
    destination_url = excluded.destination_url,
    roblox_item_url = excluded.roblox_item_url,
    official_name = excluded.official_name,
    asset_type_id = excluded.asset_type_id,
    creator_id = excluded.creator_id,
    creator_name = excluded.creator_name,
    thumbnail_url = excluded.thumbnail_url,
    thumbnail_state = excluded.thumbnail_state,
    thumbnail_checked_at = excluded.thumbnail_checked_at,
    status = excluded.status,
    status_reason = excluded.status_reason,
    consecutive_misses = 0,
    sort_order = excluded.sort_order,
    source_hash = excluded.source_hash,
    last_seen_at = excluded.last_seen_at,
    last_checked_at = excluded.last_checked_at,
    verified_at = excluded.verified_at,
    retired_at = null,
    raw_source_json = excluded.raw_source_json,
    raw_roblox_json = excluded.raw_roblox_json;

  with seen_keys as (
    select value ->> 'source_key' as source_key
    from jsonb_array_elements(p_seen_rows)
  ),
  missing_candidates as (
    select
      reward.id,
      reward.consecutive_misses + 1 as next_misses,
      reward.consecutive_misses + 1 >= p_retire_after_misses as will_retire
    from public.roblox_promo_rewards as reward
    where reward.source_provider = 'robloxden'
      and reward.status <> 'inactive'
      and not exists (
        select 1 from seen_keys where seen_keys.source_key = reward.source_key
      )
  ),
  updated_missing as (
    update public.roblox_promo_rewards as reward
    set
      consecutive_misses = candidate.next_misses,
      last_checked_at = p_checked_at,
      status = case when candidate.will_retire then 'inactive' else reward.status end,
      status_reason = case
        when candidate.will_retire
          then 'missing_from_' || p_retire_after_misses::text || '_complete_source_refreshes'
        else reward.status_reason
      end,
      retired_at = case when candidate.will_retire then p_checked_at else reward.retired_at end
    from missing_candidates as candidate
    where reward.id = candidate.id
    returning candidate.will_retire
  )
  select count(*), count(*) filter (where will_retire)
  into v_missing_updated, v_retired
  from updated_missing;

  if p_touch_catalog then
    update public.catalog_pages
    set updated_at = p_checked_at
    where code = 'roblox-promo-codes';
    get diagnostics v_catalog_touched = row_count;
  end if;

  return jsonb_build_object(
    'seen_count', v_seen_count,
    'missing_updated', v_missing_updated,
    'retired', v_retired,
    'catalog_touched', v_catalog_touched
  );
end;
$$;


ALTER FUNCTION "public"."refresh_roblox_promo_rewards"("p_seen_rows" "jsonb", "p_checked_at" timestamp with time zone, "p_retire_after_misses" integer, "p_touch_catalog" boolean) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."refresh_search_index_music"() RETURNS "void"
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


ALTER FUNCTION "public"."refresh_search_index_music"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."refresh_stats_creator_current_index"() RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'extensions'
    SET "statement_timeout" TO '120s'
    AS $$
declare
  refreshed_at timestamptz := now();
  creator_count integer := 0;
begin
  perform set_config('statement_timeout', '120000', true);

  delete from public.stats_creator_current_index where true;

  with base as (
    select
      lower(g.creator_type) as creator_type,
      g.creator_id,
      btrim(g.creator_name) as creator_name,
      g.universe_id,
      g.slug,
      g.name,
      g.display_name,
      g.icon_url,
      coalesce(g.playing, 0) as playing,
      coalesce(g.visits, 0) as visits,
      coalesce(g.favorites, 0) as favorites,
      coalesce(g.likes, 0) as likes,
      coalesce(g.dislikes, 0) as dislikes,
      g.stats_tier,
      g.last_stats_refreshed_at,
      u.creator_has_verified_badge,
      groups.name as group_name,
      groups.member_count,
      groups.has_verified_badge as group_has_verified_badge
    from public.stats_game_current_index g
    left join public.roblox_universes u on u.universe_id = g.universe_id
    left join public.roblox_groups groups
      on lower(g.creator_type) = 'group'
     and groups.group_id = g.creator_id
    where g.creator_id is not null
      and g.creator_name is not null
      and btrim(g.creator_name) <> ''
      and lower(g.creator_type) in ('group', 'user')
  ),
  ranked as (
    select
      *,
      row_number() over (
        partition by creator_type, creator_id
        order by playing desc nulls last, visits desc nulls last, universe_id asc
      ) as rn
    from base
  )
  insert into public.stats_creator_current_index (
    creator_key,
    creator_type,
    creator_id,
    creator_name,
    creator_slug,
    game_count,
    hot_game_count,
    warm_game_count,
    new_game_count,
    cold_game_count,
    playing,
    visits,
    favorites,
    likes,
    dislikes,
    rating_percent,
    top_universe_id,
    top_slug,
    top_name,
    top_display_name,
    top_icon_url,
    top_playing,
    top_visits,
    top_favorites,
    member_count,
    has_verified_badge,
    last_stats_refreshed_at,
    indexed_at
  )
  select
    creator_type || ':' || creator_id::text,
    creator_type,
    creator_id,
    coalesce(max(group_name), max(creator_name) filter (where rn = 1), max(creator_name)),
    public.slugify_stats_label(coalesce(max(group_name), max(creator_name) filter (where rn = 1), max(creator_name))) || '-' || creator_type || '-' || creator_id::text,
    count(*)::integer,
    count(*) filter (where stats_tier = 'HOT')::integer,
    count(*) filter (where stats_tier = 'WARM')::integer,
    count(*) filter (where stats_tier = 'NEW')::integer,
    count(*) filter (where stats_tier = 'COLD')::integer,
    coalesce(sum(playing), 0)::bigint,
    coalesce(sum(visits), 0)::bigint,
    coalesce(sum(favorites), 0)::bigint,
    coalesce(sum(likes), 0)::bigint,
    coalesce(sum(dislikes), 0)::bigint,
    case
      when coalesce(sum(likes), 0) + coalesce(sum(dislikes), 0) <= 0 then null
      else round((coalesce(sum(likes), 0)::numeric / (coalesce(sum(likes), 0) + coalesce(sum(dislikes), 0))::numeric) * 1000) / 10
    end,
    max(universe_id) filter (where rn = 1),
    max(slug) filter (where rn = 1),
    max(name) filter (where rn = 1),
    max(display_name) filter (where rn = 1),
    max(icon_url) filter (where rn = 1),
    max(playing) filter (where rn = 1),
    max(visits) filter (where rn = 1),
    max(favorites) filter (where rn = 1),
    max(member_count),
    case
      when creator_type = 'group' then bool_or(coalesce(group_has_verified_badge, false))
      else bool_or(coalesce(creator_has_verified_badge, false))
    end,
    max(last_stats_refreshed_at),
    refreshed_at
  from ranked
  group by creator_type, creator_id;

  get diagnostics creator_count = row_count;

  return jsonb_build_object(
    'indexed_at', refreshed_at,
    'creators', creator_count
  );
end;
$$;


ALTER FUNCTION "public"."refresh_stats_creator_current_index"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."refresh_stats_current_indexes"() RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'extensions'
    SET "statement_timeout" TO '120s'
    AS $$
declare
  refreshed_at timestamptz := now();
  target_24h timestamptz := date_trunc('hour', now() - interval '24 hours');
  target_7d timestamptz := date_trunc('hour', now() - interval '7 days');
  game_count integer := 0;
  genre_count integer := 0;
  riser_count integer := 0;
begin
  perform set_config('statement_timeout', '120000', true);

  delete from public.stats_risers_current_index where true;
  delete from public.stats_genre_current_index where true;
  delete from public.stats_game_current_index where true;

  with baseline_24h as (
    select distinct on (h.universe_id)
      h.universe_id,
      h.playing
    from public.roblox_universe_stats_hourly h
    where h.playing is not null
      and h.hour_start between target_24h - interval '90 minutes' and target_24h + interval '90 minutes'
    order by h.universe_id, abs(extract(epoch from (h.hour_start - target_24h)))
  ),
  baseline_7d as (
    select distinct on (h.universe_id)
      h.universe_id,
      h.playing
    from public.roblox_universe_stats_hourly h
    where h.playing is not null
      and h.hour_start between target_7d - interval '90 minutes' and target_7d + interval '90 minutes'
    order by h.universe_id, abs(extract(epoch from (h.hour_start - target_7d)))
  ),
  peak_24h as (
    select h.universe_id, max(h.peak_playing)::bigint as peak_playing
    from public.roblox_universe_stats_hourly h
    where h.hour_start >= refreshed_at - interval '24 hours'
    group by h.universe_id
  ),
  peak_7d as (
    select h.universe_id, max(h.peak_playing)::bigint as peak_playing
    from public.roblox_universe_stats_hourly h
    where h.hour_start >= refreshed_at - interval '7 days'
    group by h.universe_id
  ),
  latest_rank_hour as (
    select max(hour_start) as hour_start
    from public.roblox_universe_rank_snapshots_hourly
  ),
  latest_global_rank as (
    select universe_id, rank_value
    from public.roblox_universe_rank_snapshots_hourly
    where rank_type = 'global_playing'
      and hour_start = (select hour_start from latest_rank_hour)
  ),
  latest_genre_rank as (
    select universe_id, rank_value
    from public.roblox_universe_rank_snapshots_hourly
    where rank_type = 'genre_playing'
      and hour_start = (select hour_start from latest_rank_hour)
  ),
  latest_subgenre_rank as (
    select universe_id, rank_value
    from public.roblox_universe_rank_snapshots_hourly
    where rank_type = 'subgenre_playing'
      and hour_start = (select hour_start from latest_rank_hour)
  )
  insert into public.stats_game_current_index (
    universe_id,
    root_place_id,
    slug,
    name,
    display_name,
    description,
    creator_id,
    creator_name,
    creator_type,
    genre,
    genre_l1,
    genre_l2,
    age_rating,
    icon_url,
    thumbnail_urls,
    playing,
    visits,
    favorites,
    likes,
    dislikes,
    rating_percent,
    stats_tier,
    created_at_api,
    updated_at_api,
    last_stats_refreshed_at,
    last_playing_refreshed_at,
    desktop_enabled,
    mobile_enabled,
    tablet_enabled,
    console_enabled,
    vr_enabled,
    baseline_playing_24h,
    baseline_playing_7d,
    growth_24h,
    growth_24h_percent,
    growth_7d,
    growth_7d_percent,
    peak_24h,
    peak_7d,
    global_playing_rank,
    genre_playing_rank,
    subgenre_playing_rank,
    indexed_at
  )
  select
    u.universe_id,
    u.root_place_id,
    u.slug,
    u.name,
    u.display_name,
    u.description,
    u.creator_id,
    u.creator_name,
    u.creator_type,
    u.genre,
    u.genre_l1,
    u.genre_l2,
    u.age_rating,
    u.icon_url,
    coalesce(u.thumbnail_urls, '[]'::jsonb),
    u.playing,
    u.visits,
    u.favorites,
    u.likes,
    u.dislikes,
    case
      when coalesce(u.likes, 0) + coalesce(u.dislikes, 0) <= 0 then null
      else round((coalesce(u.likes, 0)::numeric / (coalesce(u.likes, 0) + coalesce(u.dislikes, 0))::numeric) * 1000) / 10
    end,
    u.stats_tier,
    u.created_at_api,
    u.updated_at_api,
    u.last_stats_refreshed_at,
    u.last_playing_refreshed_at,
    u.desktop_enabled,
    u.mobile_enabled,
    u.tablet_enabled,
    u.console_enabled,
    u.vr_enabled,
    baseline_24h.playing,
    baseline_7d.playing,
    case when u.playing is not null and baseline_24h.playing is not null then u.playing - baseline_24h.playing else null end,
    public.percent_delta(u.playing::numeric, baseline_24h.playing::numeric),
    case when u.playing is not null and baseline_7d.playing is not null then u.playing - baseline_7d.playing else null end,
    public.percent_delta(u.playing::numeric, baseline_7d.playing::numeric),
    peak_24h.peak_playing,
    peak_7d.peak_playing,
    latest_global_rank.rank_value,
    latest_genre_rank.rank_value,
    latest_subgenre_rank.rank_value,
    refreshed_at
  from public.roblox_universes u
  left join baseline_24h on baseline_24h.universe_id = u.universe_id
  left join baseline_7d on baseline_7d.universe_id = u.universe_id
  left join peak_24h on peak_24h.universe_id = u.universe_id
  left join peak_7d on peak_7d.universe_id = u.universe_id
  left join latest_global_rank on latest_global_rank.universe_id = u.universe_id
  left join latest_genre_rank on latest_genre_rank.universe_id = u.universe_id
  left join latest_subgenre_rank on latest_subgenre_rank.universe_id = u.universe_id
  where u.slug is not null;

  get diagnostics game_count = row_count;

  with ranked as (
    select
      public.slugify_stats_label(coalesce(nullif(btrim(genre_l1), ''), 'Uncategorized')) as genre_slug,
      coalesce(nullif(btrim(genre_l1), ''), 'Uncategorized') as genre,
      universe_id,
      name,
      slug,
      icon_url,
      playing,
      visits,
      row_number() over (
        partition by coalesce(nullif(btrim(genre_l1), ''), 'Uncategorized')
        order by playing desc nulls last, universe_id asc
      ) as rn
    from public.stats_game_current_index
  )
  insert into public.stats_genre_current_index (
    genre_slug,
    genre,
    games,
    playing,
    visits,
    top_universe_id,
    top_name,
    top_slug,
    top_icon_url,
    top_playing,
    indexed_at
  )
  select
    genre_slug,
    min(genre) as genre,
    count(*)::integer as games,
    coalesce(sum(playing), 0)::bigint as playing,
    coalesce(sum(visits), 0)::bigint as visits,
    max(universe_id) filter (where rn = 1) as top_universe_id,
    max(name) filter (where rn = 1) as top_name,
    max(slug) filter (where rn = 1) as top_slug,
    max(icon_url) filter (where rn = 1) as top_icon_url,
    max(playing) filter (where rn = 1) as top_playing,
    refreshed_at
  from ranked
  group by genre_slug;

  get diagnostics genre_count = row_count;

  with eligible as (
    select
      universe_id,
      slug,
      name,
      icon_url,
      nullif(btrim(genre_l1), '') as genre,
      playing,
      baseline_playing_24h,
      growth_24h,
      growth_24h_percent,
      (
        least(greatest(coalesce(growth_24h, 0), 0), 50000)::numeric / 50000 * 55
        + least(greatest(coalesce(growth_24h_percent, 0), 0), 300)::numeric / 300 * 30
        + least(log(greatest(coalesce(playing, 1), 1)::numeric) / log(1000000::numeric), 1) * 15
      ) as riser_score
    from public.stats_game_current_index
    where playing >= 1000
      and baseline_playing_24h is not null
      and growth_24h is not null
      and growth_24h > 0
      and growth_24h_percent is not null
  ),
  ranked as (
    select
      *,
      row_number() over (order by riser_score desc, growth_24h desc, playing desc, universe_id asc) as rank_value
    from eligible
  )
  insert into public.stats_risers_current_index (
    universe_id,
    slug,
    name,
    icon_url,
    genre,
    playing,
    baseline_playing_24h,
    growth_24h,
    growth_24h_percent,
    riser_score,
    eligibility_threshold,
    rank_value,
    indexed_at
  )
  select
    universe_id,
    slug,
    name,
    icon_url,
    genre,
    playing,
    baseline_playing_24h,
    growth_24h,
    growth_24h_percent,
    riser_score,
    1000,
    rank_value,
    refreshed_at
  from ranked;

  get diagnostics riser_count = row_count;

  return jsonb_build_object(
    'indexed_at', refreshed_at,
    'games', game_count,
    'genres', genre_count,
    'risers', riser_count
  );
end;
$$;


ALTER FUNCTION "public"."refresh_stats_current_indexes"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."refresh_stats_item_current_indexes"() RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'extensions'
    AS $$
declare
  refreshed_at timestamptz := now();
  item_count integer := 0;
  mover_count integer := 0;
begin
  delete from public.stats_item_price_movers_current_index where true;
  delete from public.stats_item_current_index where true;

  with source_items_base as (
    select
      item.*,
      image.image_url as thumbnail_url,
      image.state as thumbnail_state,
      image.updated_at as thumbnail_updated_at
    from public.roblox_catalog_items item
    left join lateral (
      select i.image_url, i.state, i.updated_at
      from public.roblox_catalog_item_images i
      where i.asset_id = item.asset_id
        and i.image_url is not null
      order by
        case when i.size = '420x420' then 0 else 1 end,
        case when i.format = 'Png' then 0 else 1 end,
        i.updated_at desc
      limit 1
    ) image on true
    where item.is_deleted = false
      and item.name is not null
      and item.category is not null
      and item.subcategory is not null
      and item.favorite_count is not null
  ),
  source_items as (
    select distinct on (
      case
        when item_type = 'Bundle' then 'Bundle:' || abs(asset_id)::text
        else 'Asset:' || asset_id::text
      end
    )
      *
    from source_items_base
    order by
      case
        when item_type = 'Bundle' then 'Bundle:' || abs(asset_id)::text
        else 'Asset:' || asset_id::text
      end,
      favorite_count desc nulls last,
      last_item_stats_refreshed_at desc nulls last,
      case when item_type = 'Bundle' and asset_id < 0 then 0 else 1 end,
      asset_id asc
  ),
  enriched as (
    select
      item.*,
      baseline_24h.price_robux as baseline_price_24h,
      baseline_24h.lowest_resale_price_robux as baseline_resale_24h,
      baseline_24h.favorite_count as baseline_favorites_24h,
      baseline_7d.price_robux as baseline_price_7d,
      baseline_7d.lowest_resale_price_robux as baseline_resale_7d,
      baseline_7d.favorite_count as baseline_favorites_7d
    from source_items item
    left join lateral (
      select h.price_robux, h.lowest_resale_price_robux, h.favorite_count
      from public.roblox_catalog_item_stats_hourly h
      where h.asset_id = item.asset_id
        and h.hour_start between refreshed_at - interval '25 hours 30 minutes' and refreshed_at - interval '22 hours 30 minutes'
      order by abs(extract(epoch from (h.hour_start - (refreshed_at - interval '24 hours'))))
      limit 1
    ) baseline_24h on true
    left join lateral (
      select h.price_robux, h.lowest_resale_price_robux, h.favorite_count
      from public.roblox_catalog_item_stats_hourly h
      where h.asset_id = item.asset_id
        and h.hour_start between refreshed_at - interval '7 days 90 minutes' and refreshed_at - interval '7 days' + interval '90 minutes'
      order by abs(extract(epoch from (h.hour_start - (refreshed_at - interval '7 days'))))
      limit 1
    ) baseline_7d on true
  ),
  ranked as (
    select
      enriched.*,
      row_number() over (order by favorite_count desc nulls last, asset_id asc)::integer as global_favorites_rank,
      case
        when has_resellers = true and lowest_resale_price_robux > 0
          then row_number() over (
            partition by (has_resellers = true and lowest_resale_price_robux > 0)
            order by lowest_resale_price_robux asc nulls last, favorite_count desc nulls last, asset_id asc
          )::integer
        else null
      end as global_resale_rank,
      row_number() over (partition by category order by favorite_count desc nulls last, asset_id asc)::integer as category_favorites_rank,
      case
        when has_resellers = true and lowest_resale_price_robux > 0
          then row_number() over (
            partition by category, (has_resellers = true and lowest_resale_price_robux > 0)
            order by lowest_resale_price_robux asc nulls last, favorite_count desc nulls last, asset_id asc
          )::integer
        else null
      end as category_resale_rank
    from enriched
  )
  insert into public.stats_item_current_index (
    asset_id,
    item_type,
    asset_type_id,
    name,
    description,
    category,
    subcategory,
    creator_id,
    creator_target_id,
    creator_name,
    creator_type,
    creator_has_verified_badge,
    price_robux,
    price_status,
    lowest_price_robux,
    lowest_resale_price_robux,
    is_for_sale,
    has_resellers,
    is_limited,
    is_limited_unique,
    remaining,
    total_quantity,
    units_available_for_consumption,
    quantity_limit_per_user,
    sale_location_type,
    off_sale_deadline,
    collectible_item_id,
    favorite_count,
    item_stats_tier,
    first_seen_at,
    created_at,
    last_seen_at,
    last_item_stats_refreshed_at,
    last_resale_data_fetched_at,
    last_thumbnail_health_checked_at,
    thumbnail_http_status,
    thumbnail_state,
    thumbnail_url,
    thumbnail_updated_at,
    roblox_url,
    baseline_price_24h,
    baseline_resale_24h,
    baseline_favorites_24h,
    price_change_24h,
    price_change_24h_percent,
    resale_change_24h,
    resale_change_24h_percent,
    favorite_change_24h,
    favorite_change_24h_percent,
    baseline_price_7d,
    baseline_resale_7d,
    baseline_favorites_7d,
    price_change_7d,
    price_change_7d_percent,
    resale_change_7d,
    resale_change_7d_percent,
    favorite_change_7d,
    favorite_change_7d_percent,
    global_favorites_rank,
    global_resale_rank,
    category_favorites_rank,
    category_resale_rank,
    indexed_at
  )
  select
    asset_id,
    item_type,
    asset_type_id,
    name,
    description,
    category,
    subcategory,
    creator_id,
    creator_target_id,
    creator_name,
    creator_type,
    creator_has_verified_badge,
    price_robux,
    price_status,
    lowest_price_robux,
    lowest_resale_price_robux,
    is_for_sale,
    has_resellers,
    is_limited,
    is_limited_unique,
    remaining,
    total_quantity,
    units_available_for_consumption,
    quantity_limit_per_user,
    sale_location_type,
    off_sale_deadline,
    collectible_item_id,
    favorite_count,
    item_stats_tier,
    first_seen_at,
    created_at,
    last_seen_at,
    last_item_stats_refreshed_at,
    last_resale_data_fetched_at,
    last_thumbnail_health_checked_at,
    thumbnail_http_status,
    thumbnail_state,
    thumbnail_url,
    thumbnail_updated_at,
    public.stats_item_roblox_url(asset_id, item_type, raw_catalog_json),
    baseline_price_24h,
    baseline_resale_24h,
    baseline_favorites_24h,
    case when price_robux is not null and baseline_price_24h is not null then price_robux - baseline_price_24h else null end,
    public.stats_item_percent_delta(price_robux::numeric, baseline_price_24h::numeric),
    case when lowest_resale_price_robux is not null and baseline_resale_24h is not null then lowest_resale_price_robux - baseline_resale_24h else null end,
    public.stats_item_percent_delta(lowest_resale_price_robux::numeric, baseline_resale_24h::numeric),
    case when favorite_count is not null and baseline_favorites_24h is not null then favorite_count - baseline_favorites_24h else null end,
    public.stats_item_percent_delta(favorite_count::numeric, baseline_favorites_24h::numeric),
    baseline_price_7d,
    baseline_resale_7d,
    baseline_favorites_7d,
    case when price_robux is not null and baseline_price_7d is not null then price_robux - baseline_price_7d else null end,
    public.stats_item_percent_delta(price_robux::numeric, baseline_price_7d::numeric),
    case when lowest_resale_price_robux is not null and baseline_resale_7d is not null then lowest_resale_price_robux - baseline_resale_7d else null end,
    public.stats_item_percent_delta(lowest_resale_price_robux::numeric, baseline_resale_7d::numeric),
    case when favorite_count is not null and baseline_favorites_7d is not null then favorite_count - baseline_favorites_7d else null end,
    public.stats_item_percent_delta(favorite_count::numeric, baseline_favorites_7d::numeric),
    global_favorites_rank,
    global_resale_rank,
    category_favorites_rank,
    category_resale_rank,
    refreshed_at
  from ranked;

  get diagnostics item_count = row_count;

  insert into public.stats_item_price_movers_current_index (
    asset_id,
    name,
    item_type,
    category,
    subcategory,
    creator_name,
    thumbnail_url,
    price_robux,
    lowest_resale_price_robux,
    resale_change_24h,
    resale_change_24h_percent,
    price_change_24h,
    price_change_24h_percent,
    favorite_change_24h,
    mover_score,
    rank_value,
    indexed_at
  )
  select
    asset_id,
    name,
    item_type,
    category,
    subcategory,
    creator_name,
    thumbnail_url,
    price_robux,
    lowest_resale_price_robux,
    resale_change_24h,
    resale_change_24h_percent,
    price_change_24h,
    price_change_24h_percent,
    favorite_change_24h,
    (
      coalesce(abs(resale_change_24h_percent), 0) * 10
      + coalesce(abs(price_change_24h_percent), 0) * 5
      + least(coalesce(abs(favorite_change_24h), 0), 100000)::numeric / 1000
    ) as mover_score,
    row_number() over (
      order by (
        coalesce(abs(resale_change_24h_percent), 0) * 10
        + coalesce(abs(price_change_24h_percent), 0) * 5
        + least(coalesce(abs(favorite_change_24h), 0), 100000)::numeric / 1000
      ) desc, asset_id asc
    )::integer as rank_value,
    refreshed_at
  from public.stats_item_current_index
  where coalesce(abs(resale_change_24h_percent), abs(price_change_24h_percent), abs(favorite_change_24h)) is not null
  order by mover_score desc nulls last, asset_id asc
  limit 500;

  get diagnostics mover_count = row_count;

  return jsonb_build_object(
    'items', item_count,
    'price_movers', mover_count,
    'indexed_at', refreshed_at
  );
end;
$$;


ALTER FUNCTION "public"."refresh_stats_item_current_indexes"() OWNER TO "supabase_admin";


CREATE OR REPLACE FUNCTION "public"."revalidation_slugify"("p_value" "text") RETURNS "text"
    LANGUAGE "sql" IMMUTABLE
    AS $$
  select nullif(
    regexp_replace(
      trim(regexp_replace(lower(replace(coalesce(p_value, ''), '&', 'and')), '[^a-z0-9]+', ' ', 'g')),
      '[[:space:]]+',
      '-',
      'g'
    ),
    ''
  );
$$;


ALTER FUNCTION "public"."revalidation_slugify"("p_value" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."rollup_roblox_universe_stats_daily"("p_stat_date" "date", "p_finalize" boolean DEFAULT false, "p_universe_ids" bigint[] DEFAULT NULL::bigint[]) RETURNS integer
    LANGUAGE "plpgsql"
    AS $$
declare
  affected_count integer := 0;
begin
  with hourly as (
    select *
    from public.roblox_universe_stats_hourly h
    where h.hour_start >= p_stat_date::timestamptz
      and h.hour_start < (p_stat_date + 1)::timestamptz
      and (p_universe_ids is null or h.universe_id = any(p_universe_ids))
  ),
  numbered as (
    select
      h.*,
      row_number() over (partition by h.universe_id order by h.hour_start asc) as rn_first,
      row_number() over (partition by h.universe_id order by h.hour_start desc) as rn_last
    from hourly h
  ),
  rolled as (
    select
      universe_id,
      max(peak_playing) as peak_playing,
      sum(avg_playing * greatest(sample_count, 1)) filter (where avg_playing is not null)
        / nullif(sum(greatest(sample_count, 1)) filter (where avg_playing is not null), 0) as avg_playing,
      min(min_playing) as min_playing,
      max(visits_start) filter (where rn_first = 1) as visits_start,
      max(visits_end) filter (where rn_last = 1) as visits_end,
      max(favorites_start) filter (where rn_first = 1) as favorites_start,
      max(favorites_end) filter (where rn_last = 1) as favorites_end,
      max(likes_start) filter (where rn_first = 1) as likes_start,
      max(likes_end) filter (where rn_last = 1) as likes_end,
      max(dislikes_start) filter (where rn_first = 1) as dislikes_start,
      max(dislikes_end) filter (where rn_last = 1) as dislikes_end,
      max(rating_percent) filter (where rn_first = 1) as rating_start,
      max(rating_percent) filter (where rn_last = 1) as rating_end,
      sum(sample_count) as sample_count,
      max(last_sampled_at) as recorded_at
    from numbered
    group by universe_id
  ),
  upserted as (
    insert into public.roblox_universe_stats_daily (
      universe_id,
      stat_date,
      playing,
      visits,
      favorites,
      likes,
      dislikes,
      avg_playing,
      peak_playing,
      min_playing,
      visits_start,
      visits_end,
      visit_delta,
      favorites_start,
      favorites_end,
      favorite_delta,
      likes_start,
      likes_end,
      like_delta,
      dislikes_start,
      dislikes_end,
      dislike_delta,
      rating_start,
      rating_end,
      sample_count,
      snapshot,
      recorded_at,
      is_finalized,
      finalized_at
    )
    select
      universe_id,
      p_stat_date,
      peak_playing,
      visits_end,
      favorites_end,
      likes_end,
      dislikes_end,
      avg_playing,
      peak_playing,
      min_playing,
      visits_start,
      visits_end,
      case when visits_end is null or visits_start is null then null else visits_end - visits_start end,
      favorites_start,
      favorites_end,
      case when favorites_end is null or favorites_start is null then null else favorites_end - favorites_start end,
      likes_start,
      likes_end,
      case when likes_end is null or likes_start is null then null else likes_end - likes_start end,
      dislikes_start,
      dislikes_end,
      case when dislikes_end is null or dislikes_start is null then null else dislikes_end - dislikes_start end,
      rating_start,
      rating_end,
      sample_count,
      jsonb_build_object(
        'source', 'roblox_universe_stats_hourly',
        'finalized', p_finalize,
        'rating_end', rating_end,
        'rolled_up_at', now()
      ),
      coalesce(recorded_at, now()),
      p_finalize,
      case when p_finalize then now() else null end
    from rolled
    on conflict (universe_id, stat_date) do update
    set
      playing = excluded.playing,
      visits = excluded.visits,
      favorites = excluded.favorites,
      likes = excluded.likes,
      dislikes = excluded.dislikes,
      avg_playing = excluded.avg_playing,
      peak_playing = excluded.peak_playing,
      min_playing = excluded.min_playing,
      visits_start = excluded.visits_start,
      visits_end = excluded.visits_end,
      visit_delta = excluded.visit_delta,
      favorites_start = excluded.favorites_start,
      favorites_end = excluded.favorites_end,
      favorite_delta = excluded.favorite_delta,
      likes_start = excluded.likes_start,
      likes_end = excluded.likes_end,
      like_delta = excluded.like_delta,
      dislikes_start = excluded.dislikes_start,
      dislikes_end = excluded.dislikes_end,
      dislike_delta = excluded.dislike_delta,
      rating_start = excluded.rating_start,
      rating_end = excluded.rating_end,
      sample_count = excluded.sample_count,
      snapshot = coalesce(roblox_universe_stats_daily.snapshot, '{}'::jsonb) || excluded.snapshot,
      recorded_at = excluded.recorded_at,
      is_finalized = excluded.is_finalized,
      finalized_at = excluded.finalized_at
    returning 1
  )
  select count(*) into affected_count from upserted;

  return affected_count;
end;
$$;


ALTER FUNCTION "public"."rollup_roblox_universe_stats_daily"("p_stat_date" "date", "p_finalize" boolean, "p_universe_ids" bigint[]) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."run_roblox_universe_hourly_prune"("p_days" integer DEFAULT 90, "p_batch_size" integer DEFAULT 5000, "p_max_batches" integer DEFAULT 200) RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  cutoff timestamptz := date_trunc('hour', now() - make_interval(days => greatest(p_days, 1)));
  batch integer;
  result jsonb;
  stats_deleted integer;
  rank_deleted integer;
  total_stats_deleted integer := 0;
  total_rank_deleted integer := 0;
begin
  for batch in 1..greatest(p_max_batches, 1) loop
    result := public.prune_roblox_universe_hourly_history(cutoff, greatest(p_batch_size, 1));
    stats_deleted := coalesce((result->>'stats_deleted')::integer, 0);
    rank_deleted := coalesce((result->>'rank_deleted')::integer, 0);
    total_stats_deleted := total_stats_deleted + stats_deleted;
    total_rank_deleted := total_rank_deleted + rank_deleted;
    exit when stats_deleted < greatest(p_batch_size, 1)
      and rank_deleted < greatest(p_batch_size, 1);
  end loop;

  insert into public.stats_job_runs (
    job_name,
    worker_id,
    started_at,
    finished_at,
    status,
    rows_succeeded,
    metadata
  )
  values (
    'hourly-history-prune',
    'supabase-cron',
    now(),
    now(),
    'success',
    total_stats_deleted + total_rank_deleted,
    jsonb_build_object(
      'cutoff', cutoff,
      'days', p_days,
      'batch_size', p_batch_size,
      'max_batches', p_max_batches,
      'stats_deleted', total_stats_deleted,
      'rank_deleted', total_rank_deleted
    )
  );

  return jsonb_build_object(
    'cutoff', cutoff,
    'stats_deleted', total_stats_deleted,
    'rank_deleted', total_rank_deleted
  );
end;
$$;


ALTER FUNCTION "public"."run_roblox_universe_hourly_prune"("p_days" integer, "p_batch_size" integer, "p_max_batches" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."sanitize_stats_creator_top_player"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public'
    AS $$
begin
  if new.top_universe_id is not null and not exists (
    select 1
    from public.stats_game_current_index g
    where g.universe_id = new.top_universe_id
      and g.playing is not null
  ) then
    new.top_playing := null;
  end if;
  return new;
end;
$$;


ALTER FUNCTION "public"."sanitize_stats_creator_top_player"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."sanitize_stats_game_current_player"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public'
    AS $$
begin
  if new.last_playing_refreshed_at is null
    or new.last_playing_refreshed_at < now() - interval '24 hours'
  then
    new.playing := null;
    new.baseline_playing_24h := null;
    new.baseline_playing_7d := null;
    new.growth_24h := null;
    new.growth_24h_percent := null;
    new.growth_7d := null;
    new.growth_7d_percent := null;
    new.peak_24h := null;
    new.global_playing_rank := null;
    new.genre_playing_rank := null;
    new.subgenre_playing_rank := null;
  end if;
  return new;
end;
$$;


ALTER FUNCTION "public"."sanitize_stats_game_current_player"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."search_site"("p_query" "text", "p_limit" integer DEFAULT 120, "p_offset" integer DEFAULT 0) RETURNS TABLE("entity_type" "text", "entity_id" "text", "slug" "text", "title" "text", "subtitle" "text", "url" "text", "updated_at" timestamp with time zone, "active_code_count" bigint)
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
    coalesce(cp.content_updated_at, si.updated_at) as updated_at,
    case when si.entity_type = 'code' then cp.active_code_count else null end as active_code_count
  from public.search_index si
  cross join q
  left join public.code_pages_index_view cp
    on si.entity_type = 'code'
    and cp.id::text = si.entity_id
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


ALTER FUNCTION "public"."search_site"("p_query" "text", "p_limit" integer, "p_offset" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."set_article_generation_queue_idempotency_key"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public'
    AS $$
begin
  new.idempotency_key := public.article_generation_queue_idempotency_key(new.article_title, new.universe_id);
  return new;
end;
$$;


ALTER FUNCTION "public"."set_article_generation_queue_idempotency_key"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."set_article_published_at"() RETURNS "trigger"
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


ALTER FUNCTION "public"."set_article_published_at"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."set_catalog_page_published_at"() RETURNS "trigger"
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


ALTER FUNCTION "public"."set_catalog_page_published_at"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."set_checklist_published_at"() RETURNS "trigger"
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


ALTER FUNCTION "public"."set_checklist_published_at"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."set_code_page_published_at"() RETURNS "trigger"
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


ALTER FUNCTION "public"."set_code_page_published_at"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."set_google_indexing_url_state_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
begin
  new.updated_at = now();
  return new;
end;
$$;


ALTER FUNCTION "public"."set_google_indexing_url_state_updated_at"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."set_puzzle_page_published_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
begin
  if new.is_published = true
     and (tg_op = 'INSERT' or old.is_published is distinct from true)
     and new.published_at is null then
    new.published_at := now();
  end if;
  return new;
end;
$$;


ALTER FUNCTION "public"."set_puzzle_page_published_at"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."set_quiz_page_published_at"() RETURNS "trigger"
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


ALTER FUNCTION "public"."set_quiz_page_published_at"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."set_tool_published_at"() RETURNS "trigger"
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


ALTER FUNCTION "public"."set_tool_published_at"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."set_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'pg_catalog', 'public'
    AS $$
begin
  new.updated_at = now();
  return new;
end;
$$;


ALTER FUNCTION "public"."set_updated_at"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."set_wiki_page_published_at"() RETURNS "trigger"
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


ALTER FUNCTION "public"."set_wiki_page_published_at"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."slugify_stats_label"("p_value" "text") RETURNS "text"
    LANGUAGE "sql" IMMUTABLE
    AS $$
  select coalesce(nullif(regexp_replace(lower(coalesce(p_value, 'uncategorized')), '[^a-z0-9]+', '-', 'g'), ''), 'uncategorized');
$$;


ALTER FUNCTION "public"."slugify_stats_label"("p_value" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."stats_item_percent_delta"("p_current" numeric, "p_previous" numeric) RETURNS numeric
    LANGUAGE "sql" IMMUTABLE
    AS $$
  select case
    when p_current is null or p_previous is null or p_previous = 0 then null
    else round(((p_current - p_previous) / p_previous) * 100, 2)
  end;
$$;


ALTER FUNCTION "public"."stats_item_percent_delta"("p_current" numeric, "p_previous" numeric) OWNER TO "supabase_admin";


CREATE OR REPLACE FUNCTION "public"."stats_item_roblox_url"("p_asset_id" bigint, "p_item_type" "text", "p_raw_catalog_json" "jsonb") RETURNS "text"
    LANGUAGE "sql" IMMUTABLE
    AS $$
  select coalesce(
    nullif(p_raw_catalog_json ->> 'roblox_url', ''),
    case
      when p_item_type = 'Bundle' then 'https://www.roblox.com/bundles/' || abs(p_asset_id)::text
      else 'https://www.roblox.com/catalog/' || p_asset_id::text
    end
  );
$$;


ALTER FUNCTION "public"."stats_item_roblox_url"("p_asset_id" bigint, "p_item_type" "text", "p_raw_catalog_json" "jsonb") OWNER TO "supabase_admin";


CREATE OR REPLACE FUNCTION "public"."trg_canonicalize_article_media"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO ''
    AS $$
begin
  new.cover_image := replace(replace(new.cover_image,
    'https://bmwksaykcsndsvgspapz.supabase.co/storage/v1/object/public/',
    'https://media.bloxodes.com/storage/v1/object/public/'),
    'https://database.bloxodes.com/storage/v1/object/public/',
    'https://media.bloxodes.com/storage/v1/object/public/');
  new.content_md := replace(replace(new.content_md,
    'https://bmwksaykcsndsvgspapz.supabase.co/storage/v1/object/public/',
    'https://media.bloxodes.com/storage/v1/object/public/'),
    'https://database.bloxodes.com/storage/v1/object/public/',
    'https://media.bloxodes.com/storage/v1/object/public/');
  return new;
end;
$$;


ALTER FUNCTION "public"."trg_canonicalize_article_media"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."trg_canonicalize_article_source_media"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO ''
    AS $$
begin
  new.public_url := replace(replace(new.public_url,
    'https://bmwksaykcsndsvgspapz.supabase.co/storage/v1/object/public/',
    'https://media.bloxodes.com/storage/v1/object/public/'),
    'https://database.bloxodes.com/storage/v1/object/public/',
    'https://media.bloxodes.com/storage/v1/object/public/');
  return new;
end;
$$;


ALTER FUNCTION "public"."trg_canonicalize_article_source_media"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."trg_canonicalize_code_page_media"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO ''
    AS $$
begin
  new.cover_image := replace(replace(new.cover_image,
    'https://bmwksaykcsndsvgspapz.supabase.co/storage/v1/object/public/',
    'https://media.bloxodes.com/storage/v1/object/public/'),
    'https://database.bloxodes.com/storage/v1/object/public/',
    'https://media.bloxodes.com/storage/v1/object/public/');
  new.intro_md := replace(replace(new.intro_md,
    'https://bmwksaykcsndsvgspapz.supabase.co/storage/v1/object/public/',
    'https://media.bloxodes.com/storage/v1/object/public/'),
    'https://database.bloxodes.com/storage/v1/object/public/',
    'https://media.bloxodes.com/storage/v1/object/public/');
  new.redeem_md := replace(replace(new.redeem_md,
    'https://bmwksaykcsndsvgspapz.supabase.co/storage/v1/object/public/',
    'https://media.bloxodes.com/storage/v1/object/public/'),
    'https://database.bloxodes.com/storage/v1/object/public/',
    'https://media.bloxodes.com/storage/v1/object/public/');
  new.rewards_md := replace(replace(new.rewards_md,
    'https://bmwksaykcsndsvgspapz.supabase.co/storage/v1/object/public/',
    'https://media.bloxodes.com/storage/v1/object/public/'),
    'https://database.bloxodes.com/storage/v1/object/public/',
    'https://media.bloxodes.com/storage/v1/object/public/');
  new.troubleshoot_md := replace(replace(new.troubleshoot_md,
    'https://bmwksaykcsndsvgspapz.supabase.co/storage/v1/object/public/',
    'https://media.bloxodes.com/storage/v1/object/public/'),
    'https://database.bloxodes.com/storage/v1/object/public/',
    'https://media.bloxodes.com/storage/v1/object/public/');
  new.find_codes_md := replace(replace(new.find_codes_md,
    'https://bmwksaykcsndsvgspapz.supabase.co/storage/v1/object/public/',
    'https://media.bloxodes.com/storage/v1/object/public/'),
    'https://database.bloxodes.com/storage/v1/object/public/',
    'https://media.bloxodes.com/storage/v1/object/public/');
  return new;
end;
$$;


ALTER FUNCTION "public"."trg_canonicalize_code_page_media"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."trg_comments_revalidate_code"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'pg_catalog', 'public'
    AS $$
begin
  if new.entity_type = 'code' and new.status = 'approved' and (tg_op = 'INSERT' or old.status is distinct from new.status) then
    insert into public.revalidation_events (entity_type, slug, source)
    select 'code', cp.slug, 'comment'
    from public.code_pages cp
    where cp.id = new.entity_id
    on conflict (entity_type, slug)
    do update set
      source = excluded.source,
      created_at = now();
  end if;
  return new;
end;
$$;


ALTER FUNCTION "public"."trg_comments_revalidate_code"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."trg_comments_revalidate_entity"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
declare
  target_entity_type text;
  target_entity_id uuid;
  event_source text;
begin
  if tg_op = 'DELETE' then
    target_entity_type := old.entity_type;
    target_entity_id := old.entity_id;
    event_source := 'comments_delete';
  else
    target_entity_type := new.entity_type;
    target_entity_id := new.entity_id;
    event_source := 'comments_' || lower(tg_op);
  end if;

  if target_entity_type = 'code' then
    insert into public.revalidation_events(entity_type, slug, source)
    select 'code', lower(g.slug), event_source
    from public.code_pages g
    where g.id = target_entity_id;
  elsif target_entity_type = 'article' then
    insert into public.revalidation_events(entity_type, slug, source)
    select 'article', lower(a.slug), event_source
    from public.articles a
    where a.id = target_entity_id;
  elsif target_entity_type = 'catalog' then
    insert into public.revalidation_events(entity_type, slug, source)
    select 'catalog', lower(c.code), event_source
    from public.catalog_pages c
    where c.id = target_entity_id;
  elsif target_entity_type = 'event' then
    insert into public.revalidation_events(entity_type, slug, source)
    select 'event', lower(e.slug), event_source
    from public.events_pages e
    where e.id = target_entity_id;
  elsif target_entity_type = 'tool' then
    insert into public.revalidation_events(entity_type, slug, source)
    select 'tool', lower(t.code), event_source
    from public.tools t
    where t.id = target_entity_id;
  elsif target_entity_type = 'wiki' then
    insert into public.revalidation_events(entity_type, slug, source)
    select 'wiki', lower(w.slug), event_source
    from public.wiki_pages w
    where w.id = target_entity_id;
  elsif target_entity_type = 'wiki_collection' then
    insert into public.revalidation_events(entity_type, slug, source)
    select 'wiki_collection', lower(wcp.wiki_slug || '/' || wcp.collection_slug), event_source
    from public.wiki_collection_pages wcp
    where wcp.id = target_entity_id;
  end if;

  return null;
end;
$$;


ALTER FUNCTION "public"."trg_comments_revalidate_entity"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."trg_enqueue_revalidation_articles"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
begin
  if tg_op = 'DELETE' then
    if old.is_published = true then
      perform public.enqueue_revalidation('article', old.slug, 'articles_delete');
      perform public.enqueue_author_revalidation_for_author_id(old.author_id, 'articles_author_delete');
      perform public.enqueue_wiki_revalidation_for_universe(old.universe_id, 'articles_wiki_delete');
    end if;
    return null;
  end if;

  if new.is_published = true then
    perform public.enqueue_revalidation('article', new.slug, 'articles_' || lower(tg_op));
    perform public.enqueue_author_revalidation_for_author_id(new.author_id, 'articles_author_' || lower(tg_op));
    perform public.enqueue_wiki_revalidation_for_universe(new.universe_id, 'articles_wiki_' || lower(tg_op));
  end if;

  if tg_op = 'UPDATE' and old.is_published = true then
    perform public.enqueue_author_revalidation_for_author_id(old.author_id, 'articles_author_update_old');
    perform public.enqueue_wiki_revalidation_for_universe(old.universe_id, 'articles_wiki_update_old');

    if old.slug is distinct from new.slug or new.is_published is distinct from true then
      perform public.enqueue_revalidation('article', old.slug, 'articles_old_slug_or_unpublish');
    end if;
  end if;

  return null;
end;
$$;


ALTER FUNCTION "public"."trg_enqueue_revalidation_articles"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."trg_enqueue_revalidation_authors"() RETURNS "trigger"
    LANGUAGE "plpgsql"
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

  -- Revalidate articles authored by this author.
  insert into public.revalidation_events (entity_type, slug, source)
  select distinct 'article', lower(a.slug), 'authors_articles_' || lower(tg_op)
  from public.articles a
  where a.author_id = author_id
    and a.slug is not null
    and trim(a.slug) <> ''
  on conflict (entity_type, slug)
  do update set
    created_at = now(),
    source = excluded.source;

  return null;
end;
$$;


ALTER FUNCTION "public"."trg_enqueue_revalidation_authors"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."trg_enqueue_revalidation_avatar_catalog_images"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
declare
  target_asset_id bigint;
  item_record record;
  page_slug text;
begin
  if tg_op = 'DELETE' then
    target_asset_id := old.asset_id;
  else
    target_asset_id := new.asset_id;
  end if;

  if target_asset_id is null then
    return null;
  end if;

  select item.category, item.subcategory, item.asset_type_id
  into item_record
  from public.roblox_catalog_items item
  where item.asset_id = target_asset_id;

  if not found then
    return null;
  end if;

  for page_slug in
    select distinct slug
    from unnest(public.avatar_catalog_slugs_for_catalog_item(
      item_record.category,
      item_record.subcategory,
      item_record.asset_type_id
    )) as slug
  loop
    perform public.enqueue_revalidation('catalog', page_slug, 'roblox_avatar_catalog_images_' || lower(tg_op));
  end loop;

  return null;
end;
$$;


ALTER FUNCTION "public"."trg_enqueue_revalidation_avatar_catalog_images"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."trg_enqueue_revalidation_avatar_catalog_items"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
declare
  page_slug text;
  old_slugs text[] := array[]::text[];
  new_slugs text[] := array[]::text[];
begin
  if tg_op <> 'INSERT' then
    old_slugs := public.avatar_catalog_slugs_for_catalog_item(old.category, old.subcategory, old.asset_type_id);
  end if;

  if tg_op <> 'DELETE' then
    new_slugs := public.avatar_catalog_slugs_for_catalog_item(new.category, new.subcategory, new.asset_type_id);
  end if;

  for page_slug in
    select distinct slug
    from unnest(old_slugs || new_slugs) as slug
  loop
    perform public.enqueue_revalidation('catalog', page_slug, 'roblox_avatar_catalog_items_' || lower(tg_op));
  end loop;

  return null;
end;
$$;


ALTER FUNCTION "public"."trg_enqueue_revalidation_avatar_catalog_items"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."trg_enqueue_revalidation_catalog_pages"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
begin
  if tg_op = 'DELETE' then
    if old.is_published = true then
      perform public.enqueue_revalidation('catalog', old.code, 'catalog_pages_delete');
      perform public.enqueue_wiki_revalidation_for_universe(old.universe_id, 'catalog_pages_wiki_delete');
    end if;
    return null;
  end if;

  if new.is_published = true then
    perform public.enqueue_revalidation('catalog', new.code, 'catalog_pages_' || lower(tg_op));
    perform public.enqueue_wiki_revalidation_for_universe(new.universe_id, 'catalog_pages_wiki_' || lower(tg_op));
  end if;

  if tg_op = 'UPDATE' and old.is_published = true then
    perform public.enqueue_wiki_revalidation_for_universe(old.universe_id, 'catalog_pages_wiki_update_old');

    if old.code is distinct from new.code or new.is_published is distinct from true then
      perform public.enqueue_revalidation('catalog', old.code, 'catalog_pages_old_code_or_unpublish');
    end if;
  end if;

  return null;
end;
$$;


ALTER FUNCTION "public"."trg_enqueue_revalidation_catalog_pages"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."trg_enqueue_revalidation_checklist_items"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
declare
  target_page_ids uuid[];
  page_record record;
begin
  if tg_op = 'DELETE' then
    target_page_ids := array_remove(array[old.page_id], null);
  elsif tg_op = 'INSERT' then
    target_page_ids := array_remove(array[new.page_id], null);
  else
    target_page_ids := array_remove(array[old.page_id, new.page_id], null);
  end if;

  for page_record in
    select distinct cp.slug, cp.universe_id
    from public.checklist_pages cp
    where cp.id = any(target_page_ids)
      and cp.is_public = true
      and cp.slug is not null
      and trim(cp.slug) <> ''
  loop
    perform public.enqueue_revalidation('checklist', page_record.slug, 'checklist_items_' || lower(tg_op));
    perform public.enqueue_wiki_revalidation_for_universe(
      page_record.universe_id,
      'checklist_items_wiki_' || lower(tg_op)
    );
  end loop;

  return null;
end;
$$;


ALTER FUNCTION "public"."trg_enqueue_revalidation_checklist_items"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."trg_enqueue_revalidation_checklist_pages"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
begin
  if tg_op = 'DELETE' then
    if old.is_public = true then
      perform public.enqueue_revalidation('checklist', old.slug, 'checklist_pages_delete');
      perform public.enqueue_wiki_revalidation_for_universe(old.universe_id, 'checklist_pages_wiki_delete');
    end if;
    return null;
  end if;

  if new.is_public = true then
    perform public.enqueue_revalidation('checklist', new.slug, 'checklist_pages_' || lower(tg_op));
    perform public.enqueue_wiki_revalidation_for_universe(new.universe_id, 'checklist_pages_wiki_' || lower(tg_op));
  end if;

  if tg_op = 'UPDATE' and old.is_public = true then
    perform public.enqueue_wiki_revalidation_for_universe(old.universe_id, 'checklist_pages_wiki_update_old');

    if old.slug is distinct from new.slug or new.is_public is distinct from true then
      perform public.enqueue_revalidation('checklist', old.slug, 'checklist_pages_old_slug_or_unpublish');
    end if;
  end if;

  return null;
end;
$$;


ALTER FUNCTION "public"."trg_enqueue_revalidation_checklist_pages"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."trg_enqueue_revalidation_code_pages"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
begin
  if tg_op = 'DELETE' then
    if old.is_published = true then
      perform public.enqueue_revalidation('code', old.slug, 'code_pages_delete');
      perform public.enqueue_wiki_revalidation_for_universe(old.universe_id, 'code_pages_wiki_delete');
    end if;
    return null;
  end if;

  if new.is_published = true then
    perform public.enqueue_revalidation('code', new.slug, 'code_pages_' || lower(tg_op));
    perform public.enqueue_wiki_revalidation_for_universe(new.universe_id, 'code_pages_wiki_' || lower(tg_op));
  end if;

  if tg_op = 'UPDATE' and old.is_published = true then
    perform public.enqueue_wiki_revalidation_for_universe(old.universe_id, 'code_pages_wiki_update_old');

    if old.slug is distinct from new.slug or new.is_published is distinct from true then
      perform public.enqueue_revalidation('code', old.slug, 'code_pages_old_slug_or_unpublish');
    end if;
  end if;

  return null;
end;
$$;


ALTER FUNCTION "public"."trg_enqueue_revalidation_code_pages"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."trg_enqueue_revalidation_codes"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
declare
  target_code_page_ids uuid[];
  code_page_record record;
begin
  if tg_op = 'DELETE' then
    target_code_page_ids := array_remove(array[old.code_page_id], null);
  elsif tg_op = 'INSERT' then
    target_code_page_ids := array_remove(array[new.code_page_id], null);
  else
    target_code_page_ids := array_remove(array[old.code_page_id, new.code_page_id], null);
  end if;

  for code_page_record in
    select distinct cp.id, cp.slug, cp.universe_id
    from public.code_pages cp
    where cp.id = any(target_code_page_ids)
      and cp.is_published = true
      and cp.slug is not null
      and trim(cp.slug) <> ''
  loop
    perform public.enqueue_revalidation('code', code_page_record.slug, 'codes_' || lower(tg_op));
    perform public.enqueue_wiki_revalidation_for_universe(code_page_record.universe_id, 'codes_wiki_' || lower(tg_op));
  end loop;

  return null;
end;
$$;


ALTER FUNCTION "public"."trg_enqueue_revalidation_codes"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."trg_enqueue_revalidation_decal_ids"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
begin
  perform public.enqueue_revalidation('catalog', 'roblox-decal-ids', 'roblox_decal_ids_' || lower(tg_op));
  return coalesce(new, old);
end;
$$;


ALTER FUNCTION "public"."trg_enqueue_revalidation_decal_ids"() OWNER TO "supabase_admin";


CREATE OR REPLACE FUNCTION "public"."trg_enqueue_revalidation_events_pages"() RETURNS "trigger"
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


ALTER FUNCTION "public"."trg_enqueue_revalidation_events_pages"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."trg_enqueue_revalidation_free_item_images"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
declare
  target_asset_id bigint;
  item_record record;
begin
  if tg_op = 'DELETE' then
    target_asset_id := old.asset_id;
  else
    target_asset_id := new.asset_id;
  end if;

  if target_asset_id is null then
    return null;
  end if;

  select *
  into item_record
  from public.roblox_catalog_items item
  where item.asset_id = target_asset_id;

  if not found then
    return null;
  end if;

  if public.qualifies_for_free_items_catalog(
    item_record.price_robux,
    item_record.is_deleted,
    item_record.is_for_sale,
    item_record.has_resellers,
    item_record.lowest_resale_price_robux,
    item_record.name,
    item_record.category,
    item_record.subcategory,
    item_record.favorite_count,
    item_record.free_claimability,
    item_record.free_verified_at,
    item_record.free_verification_source
  ) then
    perform public.enqueue_revalidation('catalog', 'free-roblox-items', 'roblox_catalog_item_images_' || lower(tg_op));
    perform public.enqueue_free_items_catalog_scope(
      item_record.category,
      item_record.subcategory,
      'roblox_catalog_item_images_scope_' || lower(tg_op)
    );
  end if;

  return null;
end;
$$;


ALTER FUNCTION "public"."trg_enqueue_revalidation_free_item_images"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."trg_enqueue_revalidation_free_items_catalog"() RETURNS "trigger"
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
      old.is_for_sale,
      old.has_resellers,
      old.lowest_resale_price_robux,
      old.name,
      old.category,
      old.subcategory,
      old.favorite_count,
      old.free_claimability,
      old.free_verified_at,
      old.free_verification_source
    );
  end if;

  if tg_op <> 'DELETE' then
    new_qualifies := public.qualifies_for_free_items_catalog(
      new.price_robux,
      new.is_deleted,
      new.is_for_sale,
      new.has_resellers,
      new.lowest_resale_price_robux,
      new.name,
      new.category,
      new.subcategory,
      new.favorite_count,
      new.free_claimability,
      new.free_verified_at,
      new.free_verification_source
    );
  end if;

  if old_qualifies or new_qualifies then
    perform public.enqueue_revalidation('catalog', 'free-roblox-items', 'roblox_catalog_items_' || lower(tg_op));
  end if;

  if old_qualifies then
    perform public.enqueue_free_items_catalog_scope(
      old.category,
      old.subcategory,
      'roblox_catalog_items_scope_old_' || lower(tg_op)
    );
  end if;

  if new_qualifies then
    perform public.enqueue_free_items_catalog_scope(
      new.category,
      new.subcategory,
      'roblox_catalog_items_scope_' || lower(tg_op)
    );
  end if;

  return null;
end;
$$;


ALTER FUNCTION "public"."trg_enqueue_revalidation_free_items_catalog"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."trg_enqueue_revalidation_music_ids"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
begin
  perform public.enqueue_revalidation('music', 'roblox-music-ids', 'roblox_music_ids_' || lower(tg_op));

  if tg_op <> 'INSERT' then
    perform public.enqueue_music_revalidation_scope('genres', old.genre, 'roblox_music_ids_genre_old_' || lower(tg_op));
    perform public.enqueue_music_revalidation_scope('artists', old.artist, 'roblox_music_ids_artist_old_' || lower(tg_op));
  end if;

  if tg_op <> 'DELETE' then
    perform public.enqueue_music_revalidation_scope('genres', new.genre, 'roblox_music_ids_genre_' || lower(tg_op));
    perform public.enqueue_music_revalidation_scope('artists', new.artist, 'roblox_music_ids_artist_' || lower(tg_op));
  end if;

  return null;
end;
$$;


ALTER FUNCTION "public"."trg_enqueue_revalidation_music_ids"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."trg_enqueue_revalidation_promo_rewards"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
begin
  perform public.enqueue_revalidation(
    'catalog',
    'roblox-promo-codes',
    'roblox_promo_rewards_' || lower(tg_op)
  );
  return coalesce(new, old);
end;
$$;


ALTER FUNCTION "public"."trg_enqueue_revalidation_promo_rewards"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."trg_enqueue_revalidation_puzzle_answers"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
declare
  v_slug text;
  v_answer_date text;
begin
  if tg_op = 'DELETE' then
    v_slug := old.puzzle_slug;
    v_answer_date := old.answer_date::text;
  else
    v_slug := new.puzzle_slug;
    v_answer_date := new.answer_date::text;
  end if;

  perform public.enqueue_revalidation('puzzle', v_slug, 'puzzle_answers_' || lower(tg_op));
  perform public.enqueue_revalidation('puzzle', v_slug || '/' || v_answer_date, 'puzzle_answers_archive_' || lower(tg_op));
  return null;
end;
$$;


ALTER FUNCTION "public"."trg_enqueue_revalidation_puzzle_answers"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."trg_enqueue_revalidation_puzzle_pages"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
begin
  if tg_op = 'DELETE' then
    perform public.enqueue_revalidation('puzzle', old.slug, 'puzzle_pages_delete');
  elsif new.is_published = true then
    perform public.enqueue_revalidation('puzzle', new.slug, 'puzzle_pages_' || lower(tg_op));
  elsif tg_op = 'UPDATE' and old.is_published = true then
    perform public.enqueue_revalidation('puzzle', old.slug, 'puzzle_pages_unpublish');
  end if;
  return null;
end;
$$;


ALTER FUNCTION "public"."trg_enqueue_revalidation_puzzle_pages"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."trg_enqueue_revalidation_quiz_pages"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
begin
  if tg_op = 'DELETE' then
    if old.is_published = true then
      perform public.enqueue_revalidation('quiz', old.code, 'quiz_pages_delete');
      perform public.enqueue_wiki_revalidation_for_universe(old.universe_id, 'quiz_pages_wiki_delete');
    end if;
    return null;
  end if;

  if new.is_published = true then
    perform public.enqueue_revalidation('quiz', new.code, 'quiz_pages_' || lower(tg_op));
    perform public.enqueue_wiki_revalidation_for_universe(new.universe_id, 'quiz_pages_wiki_' || lower(tg_op));
  end if;

  if tg_op = 'UPDATE' and old.is_published = true then
    perform public.enqueue_wiki_revalidation_for_universe(old.universe_id, 'quiz_pages_wiki_update_old');

    if old.code is distinct from new.code or new.is_published is distinct from true then
      perform public.enqueue_revalidation('quiz', old.code, 'quiz_pages_old_code_or_unpublish');
    end if;
  end if;

  return null;
end;
$$;


ALTER FUNCTION "public"."trg_enqueue_revalidation_quiz_pages"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."trg_enqueue_revalidation_stats_items"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
begin
  perform public.enqueue_revalidation('stats', 'items', tg_table_name || '_' || lower(tg_op));
  return null;
end;
$$;


ALTER FUNCTION "public"."trg_enqueue_revalidation_stats_items"() OWNER TO "supabase_admin";


CREATE OR REPLACE FUNCTION "public"."trg_enqueue_revalidation_tools"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
begin
  if tg_op = 'DELETE' then
    if old.is_published = true then
      perform public.enqueue_revalidation('tool', old.code, 'tools_delete');
      perform public.enqueue_wiki_revalidation_for_universe(old.universe_id, 'tools_wiki_delete');
    end if;
    return null;
  end if;

  if new.is_published = true then
    perform public.enqueue_revalidation('tool', new.code, 'tools_' || lower(tg_op));
    perform public.enqueue_wiki_revalidation_for_universe(new.universe_id, 'tools_wiki_' || lower(tg_op));
  end if;

  if tg_op = 'UPDATE' and old.is_published = true then
    perform public.enqueue_wiki_revalidation_for_universe(old.universe_id, 'tools_wiki_update_old');

    if old.code is distinct from new.code or new.is_published is distinct from true then
      perform public.enqueue_revalidation('tool', old.code, 'tools_old_code_or_unpublish');
    end if;
  end if;

  return null;
end;
$$;


ALTER FUNCTION "public"."trg_enqueue_revalidation_tools"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."trg_enqueue_revalidation_virtual_event_assets"() RETURNS "trigger"
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


ALTER FUNCTION "public"."trg_enqueue_revalidation_virtual_event_assets"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."trg_enqueue_revalidation_virtual_events"() RETURNS "trigger"
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


ALTER FUNCTION "public"."trg_enqueue_revalidation_virtual_events"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."trg_enqueue_revalidation_wiki_collection_pages"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'pg_catalog', 'public'
    AS $$
declare
  new_slug text;
  old_slug text;
begin
  if tg_op = 'DELETE' then
    if old.is_published = true then
      old_slug := old.wiki_slug || '/' || old.collection_slug;
      perform public.enqueue_revalidation('wiki_collection', old_slug, 'wiki_collection_pages_delete');
      perform public.enqueue_revalidation('wiki', old.wiki_slug, 'wiki_collection_pages_wiki_delete');
    end if;
    return null;
  end if;

  if new.is_published = true then
    new_slug := new.wiki_slug || '/' || new.collection_slug;
    perform public.enqueue_revalidation('wiki_collection', new_slug, 'wiki_collection_pages_' || lower(tg_op));
    perform public.enqueue_revalidation('wiki', new.wiki_slug, 'wiki_collection_pages_wiki_' || lower(tg_op));
  end if;

  if tg_op = 'UPDATE' and old.is_published = true then
    perform public.enqueue_revalidation('wiki', old.wiki_slug, 'wiki_collection_pages_wiki_update_old');

    if old.wiki_slug is distinct from new.wiki_slug
      or old.collection_slug is distinct from new.collection_slug
      or new.is_published is distinct from true then
      old_slug := old.wiki_slug || '/' || old.collection_slug;
      perform public.enqueue_revalidation('wiki_collection', old_slug, 'wiki_collection_pages_old_slug_or_unpublish');
    end if;
  end if;

  return null;
end;
$$;


ALTER FUNCTION "public"."trg_enqueue_revalidation_wiki_collection_pages"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."trg_enqueue_revalidation_wiki_pages"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
begin
  if tg_op = 'DELETE' then
    if old.is_published = true then
      perform public.enqueue_revalidation('wiki', old.slug, 'wiki_pages_delete');
    end if;
    return null;
  end if;

  if new.is_published = true then
    perform public.enqueue_revalidation('wiki', new.slug, 'wiki_pages_' || lower(tg_op));
  end if;

  if tg_op = 'UPDATE' and old.is_published = true then
    if old.slug is distinct from new.slug or new.is_published is distinct from true then
      perform public.enqueue_revalidation('wiki', old.slug, 'wiki_pages_old_slug_or_unpublish');
    end if;
  end if;

  return null;
end;
$$;


ALTER FUNCTION "public"."trg_enqueue_revalidation_wiki_pages"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."trg_enqueue_revalidation_wiki_universe"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
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


ALTER FUNCTION "public"."trg_enqueue_revalidation_wiki_universe"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."trg_normalize_section_code"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'pg_catalog', 'public'
    AS $$
begin
  new.section_code := public.normalize_section_code(new.section_code);
  return new;
end;
$$;


ALTER FUNCTION "public"."trg_normalize_section_code"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."trg_refresh_search_index_music"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'pg_catalog', 'public'
    AS $$
begin
  perform public.refresh_search_index_music();
  return null;
end;
$$;


ALTER FUNCTION "public"."trg_refresh_search_index_music"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."trg_search_index_articles"() RETURNS "trigger"
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


ALTER FUNCTION "public"."trg_search_index_articles"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."trg_search_index_authors"() RETURNS "trigger"
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


ALTER FUNCTION "public"."trg_search_index_authors"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."trg_search_index_catalog_pages"() RETURNS "trigger"
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
      new.description_md,
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


ALTER FUNCTION "public"."trg_search_index_catalog_pages"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."trg_search_index_checklists"() RETURNS "trigger"
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


ALTER FUNCTION "public"."trg_search_index_checklists"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."trg_search_index_code_pages"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
declare
  v_search text;
begin
  if tg_op = 'DELETE' then
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
      new.redeem_md,
      new.rewards_md,
      new.troubleshoot_md,
      new.find_codes_md
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


ALTER FUNCTION "public"."trg_search_index_code_pages"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."trg_search_index_events_pages"() RETURNS "trigger"
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


ALTER FUNCTION "public"."trg_search_index_events_pages"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."trg_search_index_puzzle_pages"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
declare
  v_search text;
begin
  if (tg_op = 'DELETE') then
    delete from public.search_index
    where entity_type = 'puzzle'
      and entity_id = old.id::text;
    return null;
  end if;

  v_search := left(
    concat_ws(
      ' ',
      new.title,
      new.slug,
      new.provider,
      new.seo_title,
      new.meta_description,
      new.intro_md,
      new.answer_intro_md,
      new.how_to_play_md,
      new.description_md
    ),
    3000
  );

  perform public.upsert_search_index(
    'puzzle',
    new.id::text,
    new.slug,
    new.title,
    'Puzzle',
    '/puzzles/' || new.slug,
    new.updated_at,
    new.is_published,
    v_search
  );

  return null;
end;
$$;


ALTER FUNCTION "public"."trg_search_index_puzzle_pages"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."trg_search_index_quiz_pages"() RETURNS "trigger"
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


ALTER FUNCTION "public"."trg_search_index_quiz_pages"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."trg_search_index_tools"() RETURNS "trigger"
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


ALTER FUNCTION "public"."trg_search_index_tools"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."trg_search_index_wiki_collection_pages"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'pg_catalog', 'public'
    AS $$
declare
  v_search text;
  v_slug text;
begin
  if (tg_op = 'DELETE') then
    delete from public.search_index
    where entity_type = 'wiki_collection'
      and entity_id = old.id::text;
    return null;
  end if;

  v_slug := new.wiki_slug || '/' || new.collection_slug;
  v_search := left(
    concat_ws(
      ' ',
      new.title,
      new.display_name,
      new.code,
      new.wiki_slug,
      new.collection_slug,
      new.seo_title,
      new.meta_description,
      new.intro_md,
      new.description_md,
      new.how_it_works_md,
      new.wiki_md
    ),
    3000
  );

  perform public.upsert_search_index(
    'wiki_collection',
    new.id::text,
    v_slug,
    new.title,
    'Wiki collection',
    '/wiki/' || v_slug,
    new.updated_at,
    new.is_published,
    v_search
  );

  return null;
end;
$$;


ALTER FUNCTION "public"."trg_search_index_wiki_collection_pages"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."trg_search_index_wiki_pages"() RETURNS "trigger"
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


ALTER FUNCTION "public"."trg_search_index_wiki_pages"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."upsert_code"("p_code_page_id" "uuid", "p_code" "text", "p_status" "text", "p_rewards_text" "text", "p_level_requirement" integer, "p_is_new" boolean, "p_provider_priority" integer DEFAULT 0) RETURNS "void"
    LANGUAGE "plpgsql"
    AS $$
declare
  v_code text := trim(p_code);
  v_provider_priority integer := coalesce(p_provider_priority, 0);
begin
  if v_code is null or v_code = '' then
    return;
  end if;

  if exists (
    select 1
    from public.codes
    where code_page_id = p_code_page_id
      and upper(code) = upper(v_code)
      and provider_priority > v_provider_priority
  ) then
    update public.codes
    set last_seen_at = now()
    where code_page_id = p_code_page_id
      and upper(code) = upper(v_code)
      and provider_priority > v_provider_priority;
    return;
  end if;

  insert into public.codes (code_page_id, code, status, rewards_text, level_requirement, is_new, provider_priority)
  values (p_code_page_id, v_code, p_status, p_rewards_text, p_level_requirement, p_is_new, v_provider_priority)
  on conflict (code_page_id, code) do update
  set
    status = excluded.status,
    rewards_text = excluded.rewards_text,
    level_requirement = excluded.level_requirement,
    is_new = excluded.is_new,
    provider_priority = greatest(public.codes.provider_priority, excluded.provider_priority),
    last_seen_at = now(),
    first_seen_at = case
      when public.codes.status = 'expired' and excluded.status = 'active' then now()
      else public.codes.first_seen_at
    end;
end;
$$;


ALTER FUNCTION "public"."upsert_code"("p_code_page_id" "uuid", "p_code" "text", "p_status" "text", "p_rewards_text" "text", "p_level_requirement" integer, "p_is_new" boolean, "p_provider_priority" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."upsert_roblox_universe_stats_hourly"("p_universe_id" bigint, "p_sampled_at" timestamp with time zone, "p_playing" bigint DEFAULT NULL::bigint, "p_visits" bigint DEFAULT NULL::bigint, "p_favorites" bigint DEFAULT NULL::bigint, "p_likes" bigint DEFAULT NULL::bigint, "p_dislikes" bigint DEFAULT NULL::bigint, "p_snapshot" "jsonb" DEFAULT '{}'::"jsonb") RETURNS "void"
    LANGUAGE "plpgsql"
    AS $$
declare
  bucket timestamptz := date_trunc('hour', coalesce(p_sampled_at, now()));
  rating numeric := public.calculate_roblox_rating_percent(p_likes, p_dislikes);
begin
  insert into public.roblox_universe_stats_hourly (
    universe_id,
    hour_start,
    playing,
    avg_playing,
    peak_playing,
    min_playing,
    visits,
    visits_start,
    visits_end,
    visit_delta,
    favorites,
    favorites_start,
    favorites_end,
    favorite_delta,
    likes,
    likes_start,
    likes_end,
    like_delta,
    dislikes,
    dislikes_start,
    dislikes_end,
    dislike_delta,
    rating_percent,
    sample_count,
    first_sampled_at,
    last_sampled_at,
    snapshot
  )
  values (
    p_universe_id,
    bucket,
    p_playing,
    p_playing,
    p_playing,
    p_playing,
    p_visits,
    p_visits,
    p_visits,
    0,
    p_favorites,
    p_favorites,
    p_favorites,
    0,
    p_likes,
    p_likes,
    p_likes,
    0,
    p_dislikes,
    p_dislikes,
    p_dislikes,
    0,
    rating,
    1,
    coalesce(p_sampled_at, now()),
    coalesce(p_sampled_at, now()),
    coalesce(p_snapshot, '{}'::jsonb)
  )
  on conflict (universe_id, hour_start) do update
  set
    playing = coalesce(excluded.playing, roblox_universe_stats_hourly.playing),
    avg_playing = case
      when excluded.playing is null then roblox_universe_stats_hourly.avg_playing
      when roblox_universe_stats_hourly.avg_playing is null then excluded.playing
      else ((roblox_universe_stats_hourly.avg_playing * roblox_universe_stats_hourly.sample_count) + excluded.playing)
        / (roblox_universe_stats_hourly.sample_count + 1)
    end,
    peak_playing = greatest(
      coalesce(roblox_universe_stats_hourly.peak_playing, excluded.peak_playing),
      coalesce(excluded.peak_playing, roblox_universe_stats_hourly.peak_playing)
    ),
    min_playing = least(
      coalesce(roblox_universe_stats_hourly.min_playing, excluded.min_playing),
      coalesce(excluded.min_playing, roblox_universe_stats_hourly.min_playing)
    ),
    visits = coalesce(excluded.visits, roblox_universe_stats_hourly.visits),
    visits_start = coalesce(roblox_universe_stats_hourly.visits_start, excluded.visits_start),
    visits_end = coalesce(excluded.visits_end, roblox_universe_stats_hourly.visits_end),
    visit_delta = case
      when coalesce(excluded.visits_end, roblox_universe_stats_hourly.visits_end) is null
        or coalesce(roblox_universe_stats_hourly.visits_start, excluded.visits_start) is null then null
      else coalesce(excluded.visits_end, roblox_universe_stats_hourly.visits_end)
        - coalesce(roblox_universe_stats_hourly.visits_start, excluded.visits_start)
    end,
    favorites = coalesce(excluded.favorites, roblox_universe_stats_hourly.favorites),
    favorites_start = coalesce(roblox_universe_stats_hourly.favorites_start, excluded.favorites_start),
    favorites_end = coalesce(excluded.favorites_end, roblox_universe_stats_hourly.favorites_end),
    favorite_delta = case
      when coalesce(excluded.favorites_end, roblox_universe_stats_hourly.favorites_end) is null
        or coalesce(roblox_universe_stats_hourly.favorites_start, excluded.favorites_start) is null then null
      else coalesce(excluded.favorites_end, roblox_universe_stats_hourly.favorites_end)
        - coalesce(roblox_universe_stats_hourly.favorites_start, excluded.favorites_start)
    end,
    likes = coalesce(excluded.likes, roblox_universe_stats_hourly.likes),
    likes_start = coalesce(roblox_universe_stats_hourly.likes_start, excluded.likes_start),
    likes_end = coalesce(excluded.likes_end, roblox_universe_stats_hourly.likes_end),
    like_delta = case
      when coalesce(excluded.likes_end, roblox_universe_stats_hourly.likes_end) is null
        or coalesce(roblox_universe_stats_hourly.likes_start, excluded.likes_start) is null then null
      else coalesce(excluded.likes_end, roblox_universe_stats_hourly.likes_end)
        - coalesce(roblox_universe_stats_hourly.likes_start, excluded.likes_start)
    end,
    dislikes = coalesce(excluded.dislikes, roblox_universe_stats_hourly.dislikes),
    dislikes_start = coalesce(roblox_universe_stats_hourly.dislikes_start, excluded.dislikes_start),
    dislikes_end = coalesce(excluded.dislikes_end, roblox_universe_stats_hourly.dislikes_end),
    dislike_delta = case
      when coalesce(excluded.dislikes_end, roblox_universe_stats_hourly.dislikes_end) is null
        or coalesce(roblox_universe_stats_hourly.dislikes_start, excluded.dislikes_start) is null then null
      else coalesce(excluded.dislikes_end, roblox_universe_stats_hourly.dislikes_end)
        - coalesce(roblox_universe_stats_hourly.dislikes_start, excluded.dislikes_start)
    end,
    rating_percent = coalesce(excluded.rating_percent, roblox_universe_stats_hourly.rating_percent),
    sample_count = roblox_universe_stats_hourly.sample_count + 1,
    last_sampled_at = greatest(roblox_universe_stats_hourly.last_sampled_at, excluded.last_sampled_at),
    snapshot = coalesce(roblox_universe_stats_hourly.snapshot, '{}'::jsonb) || coalesce(excluded.snapshot, '{}'::jsonb);
end;
$$;


ALTER FUNCTION "public"."upsert_roblox_universe_stats_hourly"("p_universe_id" bigint, "p_sampled_at" timestamp with time zone, "p_playing" bigint, "p_visits" bigint, "p_favorites" bigint, "p_likes" bigint, "p_dislikes" bigint, "p_snapshot" "jsonb") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."upsert_search_index"("p_entity_type" "text", "p_entity_id" "text", "p_slug" "text", "p_title" "text", "p_subtitle" "text", "p_url" "text", "p_updated_at" timestamp with time zone, "p_is_published" boolean, "p_search_text" "text") RETURNS "void"
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


ALTER FUNCTION "public"."upsert_search_index"("p_entity_type" "text", "p_entity_id" "text", "p_slug" "text", "p_title" "text", "p_subtitle" "text", "p_url" "text", "p_updated_at" timestamp with time zone, "p_is_published" boolean, "p_search_text" "text") OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."app_sessions" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "user_agent" "text",
    "expires_at" timestamp with time zone NOT NULL,
    "revoked_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "login_source_path" "text",
    "login_return_path" "text",
    CONSTRAINT "app_sessions_login_return_path_check" CHECK ((("login_return_path" IS NULL) OR (("login_return_path" ~~ '/%'::"text") AND ("login_return_path" !~~ '//%'::"text") AND (POSITION(('\'::"text") IN ("login_return_path")) = 0) AND ("login_return_path" !~~ '/auth/%'::"text")))),
    CONSTRAINT "app_sessions_login_source_path_check" CHECK ((("login_source_path" IS NULL) OR (("login_source_path" ~~ '/%'::"text") AND ("login_source_path" !~~ '//%'::"text") AND (POSITION(('\'::"text") IN ("login_source_path")) = 0) AND ("login_source_path" !~~ '/auth/%'::"text"))))
);


ALTER TABLE "public"."app_sessions" OWNER TO "postgres";


COMMENT ON COLUMN "public"."app_sessions"."login_source_path" IS 'Sanitized same-origin path where the user initiated login.';



COMMENT ON COLUMN "public"."app_sessions"."login_return_path" IS 'Sanitized same-origin path used after login completes.';



CREATE TABLE IF NOT EXISTS "public"."app_users" (
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


ALTER TABLE "public"."app_users" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."article_generation_artifacts" (
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


ALTER TABLE "public"."article_generation_artifacts" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."articles" (
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
    "sources" "text"[] DEFAULT '{}'::"text"[] NOT NULL,
    "faq_json" "jsonb" DEFAULT '[]'::"jsonb" NOT NULL
);


ALTER TABLE "public"."articles" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."authors" (
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


ALTER TABLE "public"."authors" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."roblox_universes" (
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
    "updated_at_api" timestamp with time zone,
    "last_light_enriched_at" timestamp with time zone,
    "last_deep_enriched_at" timestamp with time zone,
    "last_stats_refreshed_at" timestamp with time zone,
    "last_playing_refreshed_at" timestamp with time zone,
    "discovery_sources" "jsonb" DEFAULT '[]'::"jsonb" NOT NULL,
    "stats_tier" "text" DEFAULT 'NEW'::"text" NOT NULL,
    "stats_tier_updated_at" timestamp with time zone,
    "stats_tier_reason" "text",
    "next_stats_refresh_at" timestamp with time zone,
    "stats_refresh_locked_at" timestamp with time zone,
    "stats_refresh_locked_by" "text",
    "stats_refresh_attempt_count" integer DEFAULT 0 NOT NULL,
    "last_stats_refresh_error" "text",
    "stats_ingest_status" "text",
    "stats_ingest_status_updated_at" timestamp with time zone,
    CONSTRAINT "roblox_universes_stats_tier_check" CHECK (("stats_tier" = ANY (ARRAY['NEW'::"text", 'HOT'::"text", 'WARM'::"text", 'COLD'::"text"])))
);


ALTER TABLE "public"."roblox_universes" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."article_pages_index_view" WITH ("security_invoker"='true') AS
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


ALTER VIEW "public"."article_pages_index_view" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."article_pages_view" WITH ("security_invoker"='true') AS
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
    "art"."sources",
    "art"."faq_json",
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


ALTER VIEW "public"."article_pages_view" OWNER TO "supabase_admin";


CREATE TABLE IF NOT EXISTS "public"."article_source_images" (
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


ALTER TABLE "public"."article_source_images" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."cache_warm_events" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "path" "text" NOT NULL,
    "source" "text" DEFAULT 'revalidate'::"text" NOT NULL,
    "priority" integer DEFAULT 100 NOT NULL,
    "attempts" integer DEFAULT 0 NOT NULL,
    "last_error" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "cache_warm_events_attempts_check" CHECK (("attempts" >= 0)),
    CONSTRAINT "cache_warm_events_path_check" CHECK (("path" ~ '^/[^?#]*$'::"text"))
);


ALTER TABLE "public"."cache_warm_events" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."cache_warm_worker_runs" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "status" "text" DEFAULT 'running'::"text" NOT NULL,
    "batch_size" integer NOT NULL,
    "fetched_count" integer DEFAULT 0 NOT NULL,
    "warmed_count" integer DEFAULT 0 NOT NULL,
    "failed_count" integer DEFAULT 0 NOT NULL,
    "dropped_count" integer DEFAULT 0 NOT NULL,
    "duration_ms" integer,
    "paths" "jsonb" DEFAULT '[]'::"jsonb" NOT NULL,
    "error" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "finished_at" timestamp with time zone,
    CONSTRAINT "cache_warm_worker_runs_status_check" CHECK (("status" = ANY (ARRAY['running'::"text", 'success'::"text", 'failed'::"text", 'skipped'::"text"])))
);


ALTER TABLE "public"."cache_warm_worker_runs" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."catalog_pages" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "code" "text" NOT NULL,
    "title" "text" NOT NULL,
    "seo_title" "text" NOT NULL,
    "meta_description" "text" NOT NULL,
    "intro_md" "text",
    "how_it_works_md" "text",
    "description_json" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "faq_json" "jsonb" DEFAULT '[]'::"jsonb" NOT NULL,
    "schema_ld_json" "jsonb",
    "thumb_url" "text",
    "is_published" boolean DEFAULT true NOT NULL,
    "published_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "universe_id" bigint,
    "wiki_md" "text",
    "wiki_sort_order" integer,
    "description_md" "text"
);


ALTER TABLE "public"."catalog_pages" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."catalog_pages_view" WITH ("security_invoker"='true') AS
 SELECT "id",
    "code",
    "title",
    "seo_title",
    "meta_description",
    "intro_md",
    "how_it_works_md",
    "description_md",
    "description_json",
    "faq_json",
    "schema_ld_json",
    "thumb_url",
    "is_published",
    "published_at",
    "created_at",
    "updated_at",
    "universe_id",
    "wiki_md",
    "wiki_sort_order",
    GREATEST("updated_at", COALESCE("published_at", "updated_at")) AS "content_updated_at"
   FROM "public"."catalog_pages" "cp";


ALTER VIEW "public"."catalog_pages_view" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."checklist_items" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "page_id" "uuid" NOT NULL,
    "section_code" "text" NOT NULL,
    "title" "text" NOT NULL,
    "description" "text",
    "is_required" boolean DEFAULT false NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."checklist_items" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."checklist_pages" (
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


ALTER TABLE "public"."checklist_pages" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."checklist_pages_view" WITH ("security_invoker"='true') AS
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


ALTER VIEW "public"."checklist_pages_view" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."code_pages" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "name" "text" NOT NULL,
    "slug" "text" NOT NULL,
    "source_url" "text",
    "cover_image" "text",
    "seo_title" "text",
    "seo_description" "text",
    "is_published" boolean DEFAULT false NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "intro_md" "text",
    "redeem_md" "text",
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
    "old_slugs" "text"[] DEFAULT '{}'::"text"[] NOT NULL,
    "re_rewritten_at" timestamp with time zone,
    "interlinking_ai" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "interlinking_ai_copy_md" "text",
    "published_at" timestamp with time zone,
    "find_codes_md" "text",
    "source_url_4" "text",
    "source_url_5" "text",
    "source_url_6" "text",
    "source_url_7" "text",
    "source_url_8" "text",
    "source_url_9" "text",
    "source_url_10" "text"
);


ALTER TABLE "public"."code_pages" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."codes" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "code_page_id" "uuid" NOT NULL,
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


ALTER TABLE "public"."codes" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."code_page_code_stats" WITH ("security_invoker"='true') AS
 SELECT "cp"."id",
    "cp"."name",
    "cp"."slug",
    "cp"."cover_image",
    "cp"."created_at",
    "cp"."updated_at",
    COALESCE("stats"."active_count", (0)::bigint) AS "active_count",
    "stats"."latest_code_first_seen_at",
        CASE
            WHEN (("stats"."latest_code_first_seen_at" IS NOT NULL) AND ("stats"."latest_code_first_seen_at" > "cp"."updated_at")) THEN "stats"."latest_code_first_seen_at"
            ELSE "cp"."updated_at"
        END AS "content_updated_at"
   FROM ("public"."code_pages" "cp"
     LEFT JOIN LATERAL ( SELECT "count"(*) FILTER (WHERE ("c"."status" = 'active'::"text")) AS "active_count",
            "max"("c"."first_seen_at") FILTER (WHERE ("c"."status" = 'active'::"text")) AS "latest_code_first_seen_at"
           FROM "public"."codes" "c"
          WHERE ("c"."code_page_id" = "cp"."id")) "stats" ON (true))
  WHERE ("cp"."is_published" = true);


ALTER VIEW "public"."code_page_code_stats" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."code_pages_index_view" WITH ("security_invoker"='true') AS
 SELECT "cp"."id",
    "cp"."slug",
    "cp"."name",
    "cp"."is_published",
    "cp"."cover_image",
    "cp"."updated_at",
    "cp"."created_at",
    "cp"."universe_id",
    "cp"."internal_links",
    COALESCE("cs"."active_code_count", (0)::bigint) AS "active_code_count",
    "cs"."latest_code_first_seen_at",
    GREATEST(COALESCE("cs"."latest_code_first_seen_at", "cp"."updated_at"), "cp"."updated_at") AS "content_updated_at",
    "u"."genre_l1",
    "u"."genre_l2"
   FROM (("public"."code_pages" "cp"
     LEFT JOIN ( SELECT "codes"."code_page_id",
            "count"(*) FILTER (WHERE ("codes"."status" = 'active'::"text")) AS "active_code_count",
            "max"("codes"."first_seen_at") FILTER (WHERE ("codes"."status" = 'active'::"text")) AS "latest_code_first_seen_at"
           FROM "public"."codes"
          GROUP BY "codes"."code_page_id") "cs" ON (("cs"."code_page_id" = "cp"."id")))
     LEFT JOIN "public"."roblox_universes" "u" ON (("u"."universe_id" = "cp"."universe_id")))
  WHERE ("cp"."is_published" IS NOT NULL);


ALTER VIEW "public"."code_pages_index_view" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."code_pages_view" WITH ("security_invoker"='true') AS
 WITH "code_stats" AS (
         SELECT "c"."code_page_id",
            "jsonb_agg"("c".* ORDER BY "c"."status", "c"."last_seen_at" DESC) FILTER (WHERE ("c"."id" IS NOT NULL)) AS "codes",
            "count"(*) FILTER (WHERE ("c"."status" = 'active'::"text")) AS "active_code_count",
            "max"("c"."first_seen_at") FILTER (WHERE ("c"."status" = 'active'::"text")) AS "latest_code_first_seen_at"
           FROM "public"."codes" "c"
          GROUP BY "c"."code_page_id"
        )
 SELECT "cp"."id",
    "cp"."name",
    "cp"."slug",
    "cp"."old_slugs",
    "cp"."roblox_link",
    "cp"."universe_id",
    "cp"."community_link",
    "cp"."discord_link",
    "cp"."twitter_link",
    "cp"."youtube_link",
    "cp"."expired_codes",
    "cp"."cover_image",
    "cp"."seo_title",
    "cp"."seo_description",
    "cp"."intro_md",
    "cp"."redeem_md",
    "cp"."find_codes_md",
    "cp"."troubleshoot_md",
    "cp"."rewards_md",
    "cp"."internal_links",
    "cp"."is_published",
    "cp"."re_rewritten_at",
    "cp"."created_at",
    "cp"."updated_at",
    "u"."genre_l1",
    "u"."genre_l2",
    COALESCE("cs"."codes", '[]'::"jsonb") AS "codes",
    COALESCE("cs"."active_code_count", (0)::bigint) AS "active_code_count",
    "cs"."latest_code_first_seen_at",
    GREATEST(COALESCE("cs"."latest_code_first_seen_at", "cp"."updated_at"), "cp"."updated_at") AS "content_updated_at",
        CASE
            WHEN ("u"."universe_id" IS NULL) THEN NULL::"jsonb"
            ELSE "jsonb_build_object"('universe_id', "u"."universe_id", 'slug', "u"."slug", 'display_name', "u"."display_name", 'name', "u"."name", 'creator_name', "u"."creator_name", 'creator_id', "u"."creator_id", 'creator_type', "u"."creator_type", 'social_links', "u"."social_links", 'icon_url', "u"."icon_url", 'genre_l1', "u"."genre_l1", 'genre_l2', "u"."genre_l2", 'playing', "u"."playing", 'visits', "u"."visits", 'favorites', "u"."favorites", 'likes', "u"."likes", 'dislikes', "u"."dislikes", 'age_rating', "u"."age_rating", 'desktop_enabled', "u"."desktop_enabled", 'mobile_enabled', "u"."mobile_enabled", 'tablet_enabled', "u"."tablet_enabled", 'console_enabled', "u"."console_enabled", 'vr_enabled', "u"."vr_enabled", 'updated_at', "u"."updated_at", 'description', "u"."description", 'game_description_md', "u"."game_description_md")
        END AS "universe",
    ( SELECT COALESCE("jsonb_agg"("rec".* ORDER BY "rec"."active_code_count" DESC, "rec"."updated_at" DESC), '[]'::"jsonb") AS "coalesce"
           FROM ( SELECT "cp2"."id",
                    "cp2"."name",
                    "cp2"."slug",
                    "cp2"."cover_image",
                    COALESCE("cs2"."active_code_count", (0)::bigint) AS "active_code_count",
                    GREATEST(COALESCE("cs2"."latest_code_first_seen_at", "cp2"."updated_at"), "cp2"."updated_at") AS "content_updated_at",
                    "cp2"."updated_at",
                    "u2"."genre_l1",
                    "u2"."genre_l2"
                   FROM (("public"."code_pages" "cp2"
                     LEFT JOIN "code_stats" "cs2" ON (("cs2"."code_page_id" = "cp2"."id")))
                     LEFT JOIN "public"."roblox_universes" "u2" ON (("u2"."universe_id" = "cp2"."universe_id")))
                  WHERE (("cp2"."is_published" = true) AND ("cp2"."id" <> "cp"."id"))
                  ORDER BY COALESCE("cs2"."active_code_count", (0)::bigint) DESC, "cp2"."updated_at" DESC
                 LIMIT 6) "rec") AS "recommended_games",
    "cp"."interlinking_ai_copy_md"
   FROM (("public"."code_pages" "cp"
     LEFT JOIN "code_stats" "cs" ON (("cs"."code_page_id" = "cp"."id")))
     LEFT JOIN "public"."roblox_universes" "u" ON (("u"."universe_id" = "cp"."universe_id")));


ALTER VIEW "public"."code_pages_view" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."comments" (
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
    "page_type" "text",
    "page_url" "text",
    CONSTRAINT "comments_entity_type_check" CHECK (("entity_type" = ANY (ARRAY['code'::"text", 'article'::"text", 'catalog'::"text", 'event'::"text", 'tool'::"text", 'wiki'::"text", 'wiki_collection'::"text"]))),
    CONSTRAINT "comments_status_check" CHECK (("status" = ANY (ARRAY['pending'::"text", 'approved'::"text", 'rejected'::"text", 'deleted'::"text"])))
);


ALTER TABLE "public"."comments" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."event_guide_generation_queue" (
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


ALTER TABLE "public"."event_guide_generation_queue" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."events_pages" (
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
    "slug" "text"
);


ALTER TABLE "public"."events_pages" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."game_generation_queue" (
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


ALTER TABLE "public"."game_generation_queue" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."google_indexing_attempts" (
    "id" bigint NOT NULL,
    "url" "text" NOT NULL,
    "notification_type" "text" NOT NULL,
    "submitted_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "status_code" integer,
    "response_status" "text",
    "error_message" "text",
    "success" boolean DEFAULT false NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "google_indexing_attempts_notification_type_check" CHECK (("notification_type" = ANY (ARRAY['URL_UPDATED'::"text", 'URL_DELETED'::"text"])))
);


ALTER TABLE "public"."google_indexing_attempts" OWNER TO "postgres";


CREATE SEQUENCE IF NOT EXISTS "public"."google_indexing_attempts_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "public"."google_indexing_attempts_id_seq" OWNER TO "postgres";


ALTER SEQUENCE "public"."google_indexing_attempts_id_seq" OWNED BY "public"."google_indexing_attempts"."id";



CREATE TABLE IF NOT EXISTS "public"."google_indexing_url_state" (
    "url" "text" NOT NULL,
    "notification_type" "text" NOT NULL,
    "last_submitted_at" timestamp with time zone,
    "last_status_code" integer,
    "last_error" "text",
    "attempt_count" integer DEFAULT 0 NOT NULL,
    "success_count" integer DEFAULT 0 NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "google_indexing_url_state_notification_type_check" CHECK (("notification_type" = ANY (ARRAY['URL_UPDATED'::"text", 'URL_DELETED'::"text"])))
);


ALTER TABLE "public"."google_indexing_url_state" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."roblox_catalog_items" (
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
    "collectible_item_id" "text",
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
    "item_stats_tier" "text" DEFAULT 'NEW'::"text" NOT NULL,
    "next_item_stats_refresh_at" timestamp with time zone,
    "item_stats_refresh_locked_at" timestamp with time zone,
    "item_stats_refresh_locked_by" "text",
    "item_stats_refresh_attempt_count" integer DEFAULT 0 NOT NULL,
    "last_item_stats_refresh_error" "text",
    "last_item_stats_refreshed_at" timestamp with time zone,
    "last_resale_data_fetched_at" timestamp with time zone,
    "last_thumbnail_health_checked_at" timestamp with time zone,
    "thumbnail_http_status" integer,
    "thumbnail_last_error" "text",
    "free_claimability" "text",
    "free_verified_at" timestamp with time zone,
    "free_verification_source" "text",
    "free_restriction_reason" "text",
    CONSTRAINT "roblox_catalog_items_demand_consistency_check" CHECK ((("demand_consistency" >= 0) AND ("demand_consistency" <= 100))),
    CONSTRAINT "roblox_catalog_items_demand_level_check" CHECK (("demand_level" = ANY (ARRAY['amazing'::"text", 'popular'::"text", 'normal'::"text", 'terrible'::"text"]))),
    CONSTRAINT "roblox_catalog_items_demand_score_check" CHECK ((("demand_score" >= 0) AND ("demand_score" <= 100))),
    CONSTRAINT "roblox_catalog_items_free_claimability_check" CHECK ((("free_claimability" IS NULL) OR ("free_claimability" = ANY (ARRAY['direct'::"text", 'experience'::"text", 'unavailable'::"text"])))),
    CONSTRAINT "roblox_catalog_items_item_stats_tier_check" CHECK (("item_stats_tier" = ANY (ARRAY['NEW'::"text", 'HOT'::"text", 'WARM'::"text", 'COLD'::"text", 'TRADE'::"text", 'STALE'::"text", 'BROKEN_MEDIA'::"text"]))),
    CONSTRAINT "roblox_catalog_items_limited_type_check" CHECK (("limited_type" = ANY (ARRAY['classic'::"text", 'ugc'::"text"]))),
    CONSTRAINT "roblox_catalog_items_projected_confidence_check" CHECK ((("projected_confidence" >= 0) AND ("projected_confidence" <= 100))),
    CONSTRAINT "roblox_catalog_items_trading_value_confidence_check" CHECK ((("trading_value_confidence" >= 0) AND ("trading_value_confidence" <= 100))),
    CONSTRAINT "roblox_catalog_items_trend_direction_check" CHECK (("trend_direction" = ANY (ARRAY['rising'::"text", 'stable'::"text", 'falling'::"text"]))),
    CONSTRAINT "roblox_catalog_items_trend_strength_check" CHECK ((("trend_strength" >= 0) AND ("trend_strength" <= 100)))
);


ALTER TABLE "public"."roblox_catalog_items" OWNER TO "postgres";


COMMENT ON COLUMN "public"."roblox_catalog_items"."collectible_item_id" IS 'Collectible item UUID for UGC Limiteds (needed for marketplace-sales API)';



COMMENT ON COLUMN "public"."roblox_catalog_items"."rap" IS 'Recent Average Price from Roblox Economy API';



COMMENT ON COLUMN "public"."roblox_catalog_items"."rap_sales" IS 'Total sales count from Roblox Economy API';



COMMENT ON COLUMN "public"."roblox_catalog_items"."rap_stock" IS 'Current stock from Roblox Economy API';



COMMENT ON COLUMN "public"."roblox_catalog_items"."rap_price_points" IS 'Historical price data points from Roblox Economy API';



COMMENT ON COLUMN "public"."roblox_catalog_items"."rap_volume_points" IS 'Historical volume data points from Roblox Economy API';



COMMENT ON COLUMN "public"."roblox_catalog_items"."rap_last_fetched" IS 'When RAP data was last fetched from Roblox';



COMMENT ON COLUMN "public"."roblox_catalog_items"."trading_value" IS 'Calculated trading value using VWAP algorithm (more stable than RAP)';



COMMENT ON COLUMN "public"."roblox_catalog_items"."trading_value_confidence" IS 'Confidence in trading_value calculation (0-100), based on data quality';



COMMENT ON COLUMN "public"."roblox_catalog_items"."trend_direction" IS 'Price trend direction: rising, stable, or falling';



COMMENT ON COLUMN "public"."roblox_catalog_items"."trend_strength" IS 'Strength of trend (0-100) based on R² from linear regression';



COMMENT ON COLUMN "public"."roblox_catalog_items"."trend_change_7d" IS 'Percentage price change over last 7 days';



COMMENT ON COLUMN "public"."roblox_catalog_items"."trend_change_30d" IS 'Percentage price change over last 30 days';



COMMENT ON COLUMN "public"."roblox_catalog_items"."demand_level" IS 'Trading demand level: amazing, popular, normal, or terrible';



COMMENT ON COLUMN "public"."roblox_catalog_items"."demand_score" IS 'Demand score (0-100) based on sales velocity and consistency';



COMMENT ON COLUMN "public"."roblox_catalog_items"."demand_sales_per_day" IS 'Average sales per day based on volume history';



COMMENT ON COLUMN "public"."roblox_catalog_items"."demand_consistency" IS 'Sales consistency score (0-100), lower variance = higher score';



COMMENT ON COLUMN "public"."roblox_catalog_items"."is_projected" IS 'True if item appears to have artificially inflated RAP (projected)';



COMMENT ON COLUMN "public"."roblox_catalog_items"."projected_confidence" IS 'Confidence in projected detection (0-100)';



COMMENT ON COLUMN "public"."roblox_catalog_items"."projected_reason" IS 'Reason why item is flagged as potentially projected';



COMMENT ON COLUMN "public"."roblox_catalog_items"."trading_metrics_calculated_at" IS 'When trading metrics were last calculated';



COMMENT ON COLUMN "public"."roblox_catalog_items"."limited_type" IS 'Type of Limited: classic (old system) or ugc (new collectibles)';



COMMENT ON COLUMN "public"."roblox_catalog_items"."free_claimability" IS 'Official Roblox verification result: direct, experience, or unavailable.';



COMMENT ON COLUMN "public"."roblox_catalog_items"."free_verified_at" IS 'When free-item claimability was last checked against an official Roblox API.';



COMMENT ON COLUMN "public"."roblox_catalog_items"."free_verification_source" IS 'Source used for the final free-item availability check. Candidate discovery may come from any source; public rows require a current Roblox verification.';



COMMENT ON COLUMN "public"."roblox_catalog_items"."free_restriction_reason" IS 'Machine-readable reason an item is not directly claimable from the Roblox shop.';



CREATE OR REPLACE VIEW "public"."limited_items_trading_view" WITH ("security_invoker"='true') AS
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


ALTER VIEW "public"."limited_items_trading_view" OWNER TO "postgres";


COMMENT ON VIEW "public"."limited_items_trading_view" IS 'Simplified view of Limited items with trading data and freshness indicators for frontend';



CREATE TABLE IF NOT EXISTS "public"."puzzle_answers" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "puzzle_slug" "text" NOT NULL,
    "answer_date" "date" NOT NULL,
    "puzzle_id" "text",
    "source_url" "text",
    "fetched_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "extracted_from" "text",
    "answer_summary" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "payload" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."puzzle_answers" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."puzzle_pages" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "slug" "text" NOT NULL,
    "provider" "text" NOT NULL,
    "title" "text" NOT NULL,
    "seo_title" "text",
    "meta_description" "text",
    "intro_md" "text",
    "answer_intro_md" "text",
    "how_to_play_md" "text",
    "description_md" "text",
    "faq_json" "jsonb" DEFAULT '[]'::"jsonb" NOT NULL,
    "source_url" "text",
    "sort_order" integer DEFAULT 100 NOT NULL,
    "is_published" boolean DEFAULT true NOT NULL,
    "published_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "icon_url" "text"
);


ALTER TABLE "public"."puzzle_pages" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."puzzle_pages_view" WITH ("security_invoker"='on') AS
 SELECT "pp"."id",
    "pp"."slug",
    "pp"."provider",
    "pp"."title",
    "pp"."seo_title",
    "pp"."meta_description",
    "pp"."intro_md",
    "pp"."answer_intro_md",
    "pp"."how_to_play_md",
    "pp"."description_md",
    "pp"."faq_json",
    "pp"."source_url",
    "pp"."sort_order",
    "pp"."is_published",
    "pp"."published_at",
    "pp"."created_at",
    "pp"."updated_at",
    "pp"."icon_url",
    COALESCE("latest"."latest_answer_date", NULL::"date") AS "latest_answer_date",
    COALESCE("latest"."latest_fetched_at", NULL::timestamp with time zone) AS "latest_fetched_at",
    GREATEST("pp"."updated_at", COALESCE("pp"."published_at", "pp"."updated_at"), COALESCE("latest"."latest_fetched_at", "pp"."updated_at")) AS "content_updated_at"
   FROM ("public"."puzzle_pages" "pp"
     LEFT JOIN LATERAL ( SELECT "pa"."answer_date" AS "latest_answer_date",
            "pa"."fetched_at" AS "latest_fetched_at"
           FROM "public"."puzzle_answers" "pa"
          WHERE ("pa"."puzzle_slug" = "pp"."slug")
          ORDER BY "pa"."answer_date" DESC
         LIMIT 1) "latest" ON (true));


ALTER VIEW "public"."puzzle_pages_view" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."puzzle_sync_runs" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "puzzle_slug" "text",
    "ran_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "status" "text" NOT NULL,
    "issue" "text",
    "payload" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL
);


ALTER TABLE "public"."puzzle_sync_runs" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."quiz_pages" (
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


ALTER TABLE "public"."quiz_pages" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."quiz_pages_view" WITH ("security_invoker"='true') AS
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


ALTER VIEW "public"."quiz_pages_view" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."revalidation_events" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "entity_type" "text" NOT NULL,
    "slug" "text" NOT NULL,
    "source" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "revalidation_events_entity_type_check" CHECK (("entity_type" = ANY (ARRAY['code'::"text", 'article'::"text", 'author'::"text", 'event'::"text", 'checklist'::"text", 'tool'::"text", 'catalog'::"text", 'music'::"text", 'quiz'::"text", 'wiki'::"text", 'wiki_collection'::"text", 'stats'::"text", 'puzzle'::"text"])))
);


ALTER TABLE "public"."revalidation_events" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."revalidation_worker_runs" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "started_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "finished_at" timestamp with time zone,
    "status" "text" DEFAULT 'running'::"text" NOT NULL,
    "batch_size" integer DEFAULT 0 NOT NULL,
    "fetched_count" integer DEFAULT 0 NOT NULL,
    "processed_count" integer DEFAULT 0 NOT NULL,
    "failed_count" integer DEFAULT 0 NOT NULL,
    "status_code" integer,
    "duration_ms" integer,
    "error" "text",
    "events" "jsonb" DEFAULT '[]'::"jsonb" NOT NULL,
    "response_body" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "revalidation_worker_runs_status_check" CHECK (("status" = ANY (ARRAY['running'::"text", 'success'::"text", 'failed'::"text", 'skipped'::"text"])))
);


ALTER TABLE "public"."revalidation_worker_runs" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."roblox_catalog_categories" (
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


ALTER TABLE "public"."roblox_catalog_categories" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."roblox_catalog_discovery_hits" (
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


ALTER TABLE "public"."roblox_catalog_discovery_hits" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."roblox_catalog_discovery_runs" (
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


ALTER TABLE "public"."roblox_catalog_discovery_runs" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."roblox_catalog_item_images" (
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


ALTER TABLE "public"."roblox_catalog_item_images" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."roblox_catalog_item_resale_points" (
    "asset_id" bigint NOT NULL,
    "point_date" "date" NOT NULL,
    "resale_price_robux" bigint,
    "resale_volume" integer,
    "fetched_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "source" "text" DEFAULT 'roblox_resale_data'::"text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."roblox_catalog_item_resale_points" OWNER TO "supabase_admin";


CREATE TABLE IF NOT EXISTS "public"."roblox_catalog_item_stats_daily" (
    "asset_id" bigint NOT NULL,
    "stat_date" "date" NOT NULL,
    "sample_count" integer DEFAULT 0 NOT NULL,
    "price_open" bigint,
    "price_close" bigint,
    "price_min" bigint,
    "price_max" bigint,
    "resale_open" bigint,
    "resale_close" bigint,
    "resale_min" bigint,
    "resale_max" bigint,
    "favorites_open" bigint,
    "favorites_close" bigint,
    "favorites_delta" bigint,
    "units_available_min" bigint,
    "units_available_close" bigint,
    "last_sampled_at" timestamp with time zone,
    "finalized" boolean DEFAULT false NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."roblox_catalog_item_stats_daily" OWNER TO "supabase_admin";


CREATE TABLE IF NOT EXISTS "public"."roblox_catalog_item_stats_hourly" (
    "asset_id" bigint NOT NULL,
    "hour_start" timestamp with time zone NOT NULL,
    "sampled_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "item_type" "text",
    "price_robux" bigint,
    "lowest_price_robux" bigint,
    "lowest_resale_price_robux" bigint,
    "favorite_count" bigint,
    "is_for_sale" boolean,
    "has_resellers" boolean,
    "is_limited" boolean,
    "is_limited_unique" boolean,
    "remaining" bigint,
    "total_quantity" bigint,
    "units_available_for_consumption" bigint,
    "quantity_limit_per_user" bigint,
    "sale_location_type" "text",
    "off_sale_deadline" timestamp with time zone,
    "collectible_item_id" "text",
    "rap" bigint,
    "rap_sales" integer,
    "rap_stock" integer,
    "thumbnail_state" "text",
    "thumbnail_url" "text",
    "source" "text" DEFAULT 'item_stats_refresh'::"text" NOT NULL,
    "raw_snapshot_json" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."roblox_catalog_item_stats_hourly" OWNER TO "supabase_admin";


CREATE TABLE IF NOT EXISTS "public"."roblox_catalog_items_history" (
    "asset_id" bigint NOT NULL,
    "recorded_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "rap" bigint,
    "sales" integer,
    "price_robux" bigint,
    "is_for_sale" boolean,
    "favorite_count" bigint
);


ALTER TABLE "public"."roblox_catalog_items_history" OWNER TO "postgres";


COMMENT ON TABLE "public"."roblox_catalog_items_history" IS 'Historical snapshots of catalog items for tracking changes over time';



COMMENT ON COLUMN "public"."roblox_catalog_items_history"."rap" IS 'RAP value at this snapshot';



COMMENT ON COLUMN "public"."roblox_catalog_items_history"."sales" IS 'Total sales at this snapshot';



COMMENT ON COLUMN "public"."roblox_catalog_items_history"."price_robux" IS 'Price at this snapshot';



CREATE TABLE IF NOT EXISTS "public"."roblox_catalog_refresh_queue" (
    "asset_id" bigint NOT NULL,
    "priority" "text" DEFAULT 'new'::"text" NOT NULL,
    "next_run_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "attempts" integer DEFAULT 0 NOT NULL,
    "last_attempt_at" timestamp with time zone,
    "last_error" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."roblox_catalog_refresh_queue" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."roblox_catalog_subcategories" (
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


ALTER TABLE "public"."roblox_catalog_subcategories" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."roblox_decal_ids" (
    "asset_id" bigint NOT NULL,
    "texture_id" bigint,
    "name" "text" NOT NULL,
    "description" "text",
    "creator_id" bigint,
    "creator_type" "text",
    "creator_name" "text",
    "creator_verified" boolean,
    "roblox_created_at" timestamp with time zone,
    "roblox_updated_at" timestamp with time zone,
    "is_public_domain" boolean,
    "is_for_sale" boolean,
    "price_in_robux" integer,
    "sales" bigint,
    "purchasable" boolean,
    "vote_count" bigint,
    "upvote_percent" integer,
    "thumbnail_url" "text",
    "thumbnail_state" "text",
    "thumbnail_checked_at" timestamp with time zone,
    "status" "text" DEFAULT 'pending'::"text" NOT NULL,
    "status_reason" "text",
    "source" "text" DEFAULT 'roblox_toolbox_decal_search'::"text" NOT NULL,
    "raw_payload" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "first_seen_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "last_seen_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "verified_at" timestamp with time zone,
    "popularity_score" double precision DEFAULT 0 NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "categories" "text"[] DEFAULT '{}'::"text"[] NOT NULL,
    "primary_category" "text",
    "curated_score" double precision DEFAULT 0 NOT NULL,
    "curated_rank" integer,
    "curated_tier" "text",
    "curated_reason" "text",
    CONSTRAINT "roblox_decal_ids_creator_type_check" CHECK ((("creator_type" IS NULL) OR ("creator_type" = ANY (ARRAY['User'::"text", 'Group'::"text"])))),
    CONSTRAINT "roblox_decal_ids_status_check" CHECK (("status" = ANY (ARRAY['pending'::"text", 'active'::"text", 'inactive'::"text", 'deleted'::"text", 'private'::"text", 'moderated'::"text", 'not_decal'::"text", 'error'::"text"]))),
    CONSTRAINT "roblox_decal_ids_upvote_percent_check" CHECK ((("upvote_percent" IS NULL) OR (("upvote_percent" >= 0) AND ("upvote_percent" <= 100))))
);


ALTER TABLE "public"."roblox_decal_ids" OWNER TO "supabase_admin";


CREATE OR REPLACE VIEW "public"."roblox_decal_categories_view" WITH ("security_invoker"='true') AS
 SELECT "category"."slug",
    ("count"(*))::integer AS "item_count",
    "max"("rd"."verified_at") AS "latest_verified_at",
    "max"("rd"."curated_score") AS "top_curated_score"
   FROM ("public"."roblox_decal_ids" "rd"
     CROSS JOIN LATERAL "unnest"("rd"."categories") "category"("slug"))
  WHERE (("rd"."status" = 'active'::"text") AND ("rd"."thumbnail_state" = 'Completed'::"text") AND ("rd"."thumbnail_url" IS NOT NULL))
  GROUP BY "category"."slug";


ALTER VIEW "public"."roblox_decal_categories_view" OWNER TO "supabase_admin";


CREATE TABLE IF NOT EXISTS "public"."roblox_decal_id_sources" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "asset_id" bigint NOT NULL,
    "source_kind" "text" NOT NULL,
    "source_url" "text",
    "source_query" "text",
    "source_page" integer,
    "source_rank" integer,
    "raw_payload" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "first_seen_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "last_seen_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."roblox_decal_id_sources" OWNER TO "supabase_admin";


CREATE OR REPLACE VIEW "public"."roblox_decal_ids_ranked_view" WITH ("security_invoker"='true') AS
 SELECT "rd"."asset_id",
    "rd"."texture_id",
    "rd"."name",
    "rd"."description",
    "rd"."creator_id",
    "rd"."creator_type",
    "rd"."creator_name",
    "rd"."creator_verified",
    "rd"."roblox_created_at",
    "rd"."roblox_updated_at",
    "rd"."is_public_domain",
    "rd"."is_for_sale",
    "rd"."price_in_robux",
    "rd"."sales",
    "rd"."purchasable",
    "rd"."vote_count",
    "rd"."upvote_percent",
    "rd"."thumbnail_url",
    "rd"."thumbnail_state",
    "rd"."thumbnail_checked_at",
    "rd"."status",
    "rd"."status_reason",
    "rd"."source",
    "rd"."raw_payload",
    "rd"."first_seen_at",
    "rd"."last_seen_at",
    "rd"."verified_at",
    "rd"."popularity_score",
    "rd"."categories",
    "rd"."primary_category",
    "rd"."curated_score",
    "rd"."curated_rank",
    "rd"."curated_tier",
    "rd"."curated_reason",
    "rd"."created_at",
    "rd"."updated_at",
        CASE
            WHEN (("rd"."thumbnail_state" = 'Completed'::"text") AND ("rd"."thumbnail_url" IS NOT NULL)) THEN true
            ELSE false
        END AS "thumbnail_ready",
        CASE
            WHEN ("rd"."roblox_created_at" IS NULL) THEN 999
            WHEN ("rd"."roblox_created_at" >= ("now"() - '30 days'::interval)) THEN 0
            WHEN ("rd"."roblox_created_at" >= ("now"() - '180 days'::interval)) THEN 1
            WHEN ("rd"."roblox_created_at" >= ("now"() - '1 year'::interval)) THEN 2
            ELSE 3
        END AS "age_bucket",
    (COALESCE("src"."source_count", (0)::bigint))::integer AS "source_count"
   FROM ("public"."roblox_decal_ids" "rd"
     LEFT JOIN ( SELECT "roblox_decal_id_sources"."asset_id",
            "count"(*) AS "source_count"
           FROM "public"."roblox_decal_id_sources"
          GROUP BY "roblox_decal_id_sources"."asset_id") "src" ON (("src"."asset_id" = "rd"."asset_id")))
  WHERE ("rd"."status" = 'active'::"text");


ALTER VIEW "public"."roblox_decal_ids_ranked_view" OWNER TO "supabase_admin";


CREATE TABLE IF NOT EXISTS "public"."roblox_groups" (
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


ALTER TABLE "public"."roblox_groups" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."roblox_music_ids" (
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


ALTER TABLE "public"."roblox_music_ids" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."roblox_music_artists_view" WITH ("security_invoker"='true') AS
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


ALTER VIEW "public"."roblox_music_artists_view" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."roblox_music_genres_view" WITH ("security_invoker"='true') AS
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


ALTER VIEW "public"."roblox_music_genres_view" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."roblox_music_ids_boombox_view" WITH ("security_invoker"='true') AS
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


ALTER VIEW "public"."roblox_music_ids_boombox_view" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."roblox_music_ids_ranked_view" WITH ("security_invoker"='true') AS
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


ALTER VIEW "public"."roblox_music_ids_ranked_view" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."roblox_promo_rewards" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "source_provider" "text" DEFAULT 'robloxden'::"text" NOT NULL,
    "source_key" "text" NOT NULL,
    "source_list_url" "text" NOT NULL,
    "source_url" "text" NOT NULL,
    "asset_id" bigint NOT NULL,
    "roblox_item_type" "text" DEFAULT 'Asset'::"text" NOT NULL,
    "reward_name" "text" NOT NULL,
    "source_type" "text" NOT NULL,
    "claim_type" "text" NOT NULL,
    "promo_code" "text",
    "promo_code_normalized" "text",
    "event_name" "text",
    "requirement_text" "text",
    "claim_instructions" "text",
    "destination_url" "text",
    "roblox_item_url" "text",
    "official_name" "text",
    "asset_type_id" integer,
    "creator_id" bigint,
    "creator_name" "text",
    "thumbnail_url" "text",
    "thumbnail_state" "text",
    "thumbnail_checked_at" timestamp with time zone,
    "status" "text" DEFAULT 'source_listed_unverified'::"text" NOT NULL,
    "status_reason" "text",
    "consecutive_misses" integer DEFAULT 0 NOT NULL,
    "sort_order" integer DEFAULT 0 NOT NULL,
    "source_hash" "text" NOT NULL,
    "first_seen_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "last_seen_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "last_checked_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "verified_at" timestamp with time zone,
    "retired_at" timestamp with time zone,
    "raw_source_json" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "raw_roblox_json" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "roblox_promo_rewards_claim_type_check" CHECK (("claim_type" = ANY (ARRAY['web_promo_code'::"text", 'experience_code'::"text", 'event_task'::"text", 'creator_challenge'::"text", 'catalog_claim'::"text", 'collaboration'::"text", 'gift_card_promotion'::"text"]))),
    CONSTRAINT "roblox_promo_rewards_code_check" CHECK ((("claim_type" <> ALL (ARRAY['web_promo_code'::"text", 'experience_code'::"text"])) OR (("promo_code" IS NOT NULL) AND ("length"("btrim"("promo_code")) > 0)))),
    CONSTRAINT "roblox_promo_rewards_code_normalized_check" CHECK (((("promo_code" IS NULL) AND ("promo_code_normalized" IS NULL)) OR (("promo_code" IS NOT NULL) AND ("promo_code_normalized" = "upper"("btrim"("promo_code")))))),
    CONSTRAINT "roblox_promo_rewards_item_type_check" CHECK (("roblox_item_type" = ANY (ARRAY['Asset'::"text", 'Bundle'::"text"]))),
    CONSTRAINT "roblox_promo_rewards_misses_check" CHECK (("consecutive_misses" >= 0)),
    CONSTRAINT "roblox_promo_rewards_sort_order_check" CHECK (("sort_order" >= 0)),
    CONSTRAINT "roblox_promo_rewards_source_key_check" CHECK (("length"("btrim"("source_key")) > 0)),
    CONSTRAINT "roblox_promo_rewards_source_type_check" CHECK (("source_type" = ANY (ARRAY['code'::"text", 'event'::"text", 'creator-challenge'::"text", 'catalog-claim'::"text", 'collaboration'::"text"]))),
    CONSTRAINT "roblox_promo_rewards_status_check" CHECK (("status" = ANY (ARRAY['source_listed_unverified'::"text", 'verified_claimable'::"text", 'unavailable'::"text", 'expired'::"text", 'inactive'::"text", 'error'::"text"])))
);


ALTER TABLE "public"."roblox_promo_rewards" OWNER TO "postgres";


COMMENT ON TABLE "public"."roblox_promo_rewards" IS 'Roblox-wide promotional codes and reward offers discovered from RobloxDen and enriched with official Roblox asset metadata.';



COMMENT ON COLUMN "public"."roblox_promo_rewards"."status" IS 'Claimability state. Source listing alone is source_listed_unverified and must not be presented as official proof that an old reward is still earnable.';



COMMENT ON COLUMN "public"."roblox_promo_rewards"."raw_source_json" IS 'Private audit evidence from the discovery source. Never render this field publicly.';



CREATE TABLE IF NOT EXISTS "public"."roblox_universe_badges" (
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


ALTER TABLE "public"."roblox_universe_badges" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."roblox_universe_gamepasses" (
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


ALTER TABLE "public"."roblox_universe_gamepasses" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."roblox_universe_media" (
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
    "first_seen_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "last_seen_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "source" "text",
    CONSTRAINT "roblox_universe_media_media_type_check" CHECK (("media_type" = ANY (ARRAY['icon'::"text", 'screenshot'::"text", 'video'::"text"])))
);


ALTER TABLE "public"."roblox_universe_media" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."roblox_universe_place_servers" (
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


ALTER TABLE "public"."roblox_universe_place_servers" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."roblox_universe_rank_snapshots" (
    "universe_id" bigint NOT NULL,
    "rank_type" "text" NOT NULL,
    "rank_value" integer NOT NULL,
    "metric_value" numeric,
    "sampled_at" timestamp with time zone NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."roblox_universe_rank_snapshots" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."roblox_universe_rank_snapshots_daily" (
    "universe_id" bigint NOT NULL,
    "rank_type" "text" NOT NULL,
    "stat_date" "date" NOT NULL,
    "rank_value" integer NOT NULL,
    "metric_value" numeric,
    "sampled_at" timestamp with time zone NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."roblox_universe_rank_snapshots_daily" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."roblox_universe_rank_snapshots_hourly" (
    "universe_id" bigint NOT NULL,
    "rank_type" "text" NOT NULL,
    "hour_start" timestamp with time zone NOT NULL,
    "rank_value" integer NOT NULL,
    "metric_value" numeric,
    "sampled_at" timestamp with time zone NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."roblox_universe_rank_snapshots_hourly" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."roblox_universe_social_links" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "universe_id" bigint NOT NULL,
    "platform" "text" NOT NULL,
    "title" "text",
    "url" "text" NOT NULL,
    "raw_payload" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "fetched_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."roblox_universe_social_links" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."roblox_universe_stats_daily" (
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
    "recorded_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "avg_playing" numeric,
    "peak_playing" bigint,
    "min_playing" bigint,
    "visits_start" bigint,
    "visits_end" bigint,
    "visit_delta" bigint,
    "favorites_start" bigint,
    "favorites_end" bigint,
    "favorite_delta" bigint,
    "likes_start" bigint,
    "likes_end" bigint,
    "like_delta" bigint,
    "dislikes_start" bigint,
    "dislikes_end" bigint,
    "dislike_delta" bigint,
    "rating_start" numeric,
    "rating_end" numeric,
    "sample_count" integer,
    "is_finalized" boolean DEFAULT false NOT NULL,
    "finalized_at" timestamp with time zone
);


ALTER TABLE "public"."roblox_universe_stats_daily" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."roblox_universe_stats_hourly" (
    "universe_id" bigint NOT NULL,
    "hour_start" timestamp with time zone NOT NULL,
    "playing" bigint,
    "avg_playing" numeric,
    "peak_playing" bigint,
    "min_playing" bigint,
    "visits" bigint,
    "visits_start" bigint,
    "visits_end" bigint,
    "visit_delta" bigint,
    "favorites" bigint,
    "favorites_start" bigint,
    "favorites_end" bigint,
    "favorite_delta" bigint,
    "likes" bigint,
    "likes_start" bigint,
    "likes_end" bigint,
    "like_delta" bigint,
    "dislikes" bigint,
    "dislikes_start" bigint,
    "dislikes_end" bigint,
    "dislike_delta" bigint,
    "rating_percent" numeric,
    "sample_count" integer DEFAULT 1 NOT NULL,
    "first_sampled_at" timestamp with time zone NOT NULL,
    "last_sampled_at" timestamp with time zone NOT NULL,
    "snapshot" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "roblox_universe_stats_hourly_sample_count_check" CHECK (("sample_count" > 0))
);


ALTER TABLE "public"."roblox_universe_stats_hourly" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."roblox_universe_update_events" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "universe_id" bigint NOT NULL,
    "previous_updated_at_api" timestamp with time zone,
    "updated_at_api" timestamp with time zone NOT NULL,
    "detected_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "sampled_at" timestamp with time zone NOT NULL,
    "source" "text" DEFAULT 'update-universe-hourly-stats'::"text" NOT NULL,
    "label" "text",
    "description" "text",
    "stats_tier" "text",
    "playing" bigint,
    "visits" bigint,
    "favorites" bigint,
    "likes" bigint,
    "dislikes" bigint,
    "rating_percent" numeric,
    "raw_game_json" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."roblox_universe_update_events" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."roblox_virtual_event_categories" (
    "event_id" "text" NOT NULL,
    "category" "text" NOT NULL,
    "rank" integer NOT NULL
);


ALTER TABLE "public"."roblox_virtual_event_categories" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."roblox_virtual_event_thumbnails" (
    "event_id" "text" NOT NULL,
    "media_id" bigint NOT NULL,
    "rank" integer NOT NULL
);


ALTER TABLE "public"."roblox_virtual_event_thumbnails" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."roblox_virtual_events" (
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


ALTER TABLE "public"."roblox_virtual_events" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."search_index" (
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


ALTER TABLE "public"."search_index" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."site_feedback" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "body" "text" NOT NULL,
    "email" "text",
    "page_url" "text",
    "page_path" "text",
    "viewport_width" integer,
    "viewport_height" integer,
    "user_agent" "text",
    "ip_address" "text",
    "status" "text" DEFAULT 'new'::"text" NOT NULL,
    "metadata" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "site_feedback_body_not_blank" CHECK (("length"("btrim"("body")) > 0)),
    CONSTRAINT "site_feedback_status_check" CHECK (("status" = ANY (ARRAY['new'::"text", 'reviewed'::"text", 'closed'::"text", 'spam'::"text"])))
);


ALTER TABLE "public"."site_feedback" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."stats_creator_current_index" (
    "creator_key" "text" NOT NULL,
    "creator_type" "text" NOT NULL,
    "creator_id" bigint NOT NULL,
    "creator_name" "text" NOT NULL,
    "creator_slug" "text" NOT NULL,
    "game_count" integer DEFAULT 0 NOT NULL,
    "hot_game_count" integer DEFAULT 0 NOT NULL,
    "warm_game_count" integer DEFAULT 0 NOT NULL,
    "new_game_count" integer DEFAULT 0 NOT NULL,
    "cold_game_count" integer DEFAULT 0 NOT NULL,
    "playing" bigint DEFAULT 0 NOT NULL,
    "visits" bigint DEFAULT 0 NOT NULL,
    "favorites" bigint DEFAULT 0 NOT NULL,
    "likes" bigint DEFAULT 0 NOT NULL,
    "dislikes" bigint DEFAULT 0 NOT NULL,
    "rating_percent" numeric,
    "top_universe_id" bigint,
    "top_slug" "text",
    "top_name" "text",
    "top_display_name" "text",
    "top_icon_url" "text",
    "top_playing" bigint,
    "top_visits" bigint,
    "top_favorites" bigint,
    "member_count" bigint,
    "has_verified_badge" boolean,
    "last_stats_refreshed_at" timestamp with time zone,
    "indexed_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."stats_creator_current_index" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."stats_game_current_index" (
    "universe_id" bigint NOT NULL,
    "root_place_id" bigint,
    "slug" "text" NOT NULL,
    "name" "text" NOT NULL,
    "display_name" "text",
    "description" "text",
    "creator_id" bigint,
    "creator_name" "text",
    "creator_type" "text",
    "genre" "text",
    "genre_l1" "text",
    "genre_l2" "text",
    "age_rating" "text",
    "icon_url" "text",
    "thumbnail_urls" "jsonb" DEFAULT '[]'::"jsonb" NOT NULL,
    "playing" bigint,
    "visits" bigint,
    "favorites" bigint,
    "likes" bigint,
    "dislikes" bigint,
    "rating_percent" numeric,
    "stats_tier" "text",
    "created_at_api" timestamp with time zone,
    "updated_at_api" timestamp with time zone,
    "last_stats_refreshed_at" timestamp with time zone,
    "last_playing_refreshed_at" timestamp with time zone,
    "desktop_enabled" boolean,
    "mobile_enabled" boolean,
    "tablet_enabled" boolean,
    "console_enabled" boolean,
    "vr_enabled" boolean,
    "baseline_playing_24h" bigint,
    "baseline_playing_7d" bigint,
    "growth_24h" bigint,
    "growth_24h_percent" numeric,
    "growth_7d" bigint,
    "growth_7d_percent" numeric,
    "peak_24h" bigint,
    "peak_7d" bigint,
    "global_playing_rank" integer,
    "genre_playing_rank" integer,
    "subgenre_playing_rank" integer,
    "indexed_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."stats_game_current_index" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."stats_genre_current_index" (
    "genre_slug" "text" NOT NULL,
    "genre" "text" NOT NULL,
    "games" integer DEFAULT 0 NOT NULL,
    "playing" bigint DEFAULT 0 NOT NULL,
    "visits" bigint DEFAULT 0 NOT NULL,
    "top_universe_id" bigint,
    "top_name" "text",
    "top_slug" "text",
    "top_icon_url" "text",
    "top_playing" bigint,
    "indexed_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."stats_genre_current_index" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."stats_item_current_index" (
    "asset_id" bigint NOT NULL,
    "item_type" "text" NOT NULL,
    "asset_type_id" integer,
    "name" "text" NOT NULL,
    "description" "text",
    "category" "text",
    "subcategory" "text",
    "creator_id" bigint,
    "creator_target_id" bigint,
    "creator_name" "text",
    "creator_type" "text",
    "creator_has_verified_badge" boolean,
    "price_robux" bigint,
    "price_status" "text",
    "lowest_price_robux" bigint,
    "lowest_resale_price_robux" bigint,
    "is_for_sale" boolean,
    "has_resellers" boolean,
    "is_limited" boolean,
    "is_limited_unique" boolean,
    "remaining" bigint,
    "total_quantity" bigint,
    "units_available_for_consumption" bigint,
    "quantity_limit_per_user" bigint,
    "sale_location_type" "text",
    "off_sale_deadline" timestamp with time zone,
    "collectible_item_id" "text",
    "favorite_count" bigint,
    "item_stats_tier" "text",
    "first_seen_at" timestamp with time zone,
    "created_at" timestamp with time zone,
    "last_seen_at" timestamp with time zone,
    "last_item_stats_refreshed_at" timestamp with time zone,
    "last_resale_data_fetched_at" timestamp with time zone,
    "last_thumbnail_health_checked_at" timestamp with time zone,
    "thumbnail_http_status" integer,
    "thumbnail_state" "text",
    "thumbnail_url" "text",
    "thumbnail_updated_at" timestamp with time zone,
    "roblox_url" "text",
    "baseline_price_24h" bigint,
    "baseline_resale_24h" bigint,
    "baseline_favorites_24h" bigint,
    "price_change_24h" bigint,
    "price_change_24h_percent" numeric,
    "resale_change_24h" bigint,
    "resale_change_24h_percent" numeric,
    "favorite_change_24h" bigint,
    "favorite_change_24h_percent" numeric,
    "baseline_price_7d" bigint,
    "baseline_resale_7d" bigint,
    "baseline_favorites_7d" bigint,
    "price_change_7d" bigint,
    "price_change_7d_percent" numeric,
    "resale_change_7d" bigint,
    "resale_change_7d_percent" numeric,
    "favorite_change_7d" bigint,
    "favorite_change_7d_percent" numeric,
    "global_favorites_rank" integer,
    "global_resale_rank" integer,
    "category_favorites_rank" integer,
    "category_resale_rank" integer,
    "indexed_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."stats_item_current_index" OWNER TO "supabase_admin";


CREATE TABLE IF NOT EXISTS "public"."stats_item_price_movers_current_index" (
    "asset_id" bigint NOT NULL,
    "name" "text" NOT NULL,
    "item_type" "text" NOT NULL,
    "category" "text",
    "subcategory" "text",
    "creator_name" "text",
    "thumbnail_url" "text",
    "price_robux" bigint,
    "lowest_resale_price_robux" bigint,
    "resale_change_24h" bigint,
    "resale_change_24h_percent" numeric,
    "price_change_24h" bigint,
    "price_change_24h_percent" numeric,
    "favorite_change_24h" bigint,
    "mover_score" numeric DEFAULT 0 NOT NULL,
    "rank_value" integer NOT NULL,
    "indexed_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."stats_item_price_movers_current_index" OWNER TO "supabase_admin";


CREATE TABLE IF NOT EXISTS "public"."stats_job_runs" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "job_name" "text" NOT NULL,
    "worker_id" "text",
    "started_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "finished_at" timestamp with time zone,
    "status" "text" DEFAULT 'running'::"text" NOT NULL,
    "rows_claimed" integer DEFAULT 0 NOT NULL,
    "rows_succeeded" integer DEFAULT 0 NOT NULL,
    "rows_failed" integer DEFAULT 0 NOT NULL,
    "error" "text",
    "metadata" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "stats_job_runs_status_check" CHECK (("status" = ANY (ARRAY['running'::"text", 'success'::"text", 'failed'::"text", 'partial'::"text", 'skipped'::"text"])))
);


ALTER TABLE "public"."stats_job_runs" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."stats_risers_current_index" (
    "universe_id" bigint NOT NULL,
    "slug" "text" NOT NULL,
    "name" "text" NOT NULL,
    "icon_url" "text",
    "genre" "text",
    "playing" bigint NOT NULL,
    "baseline_playing_24h" bigint NOT NULL,
    "growth_24h" bigint NOT NULL,
    "growth_24h_percent" numeric NOT NULL,
    "riser_score" numeric NOT NULL,
    "eligibility_threshold" integer DEFAULT 1000 NOT NULL,
    "rank_value" integer NOT NULL,
    "indexed_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."stats_risers_current_index" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."tools" (
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


ALTER TABLE "public"."tools" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."tools_view" WITH ("security_invoker"='true') AS
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


ALTER VIEW "public"."tools_view" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."user_checklist_progress" (
    "user_id" "uuid" NOT NULL,
    "checklist_slug" "text" NOT NULL,
    "checked_item_ids" "text"[] DEFAULT '{}'::"text"[] NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."user_checklist_progress" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."user_code_progress" (
    "user_id" "uuid" NOT NULL,
    "game_slug" "text" NOT NULL,
    "used_code_ids" "text"[] DEFAULT '{}'::"text"[] NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."user_code_progress" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."user_quiz_progress" (
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


ALTER TABLE "public"."user_quiz_progress" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."wiki_collection_pages" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "wiki_page_id" "uuid",
    "universe_id" bigint,
    "wiki_slug" "text" NOT NULL,
    "collection_slug" "text" NOT NULL,
    "code" "text" NOT NULL,
    "title" "text" NOT NULL,
    "seo_title" "text" NOT NULL,
    "meta_description" "text" NOT NULL,
    "intro_md" "text",
    "how_it_works_md" "text",
    "description_md" "text",
    "description_json" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "faq_json" "jsonb" DEFAULT '[]'::"jsonb" NOT NULL,
    "schema_ld_json" "jsonb",
    "thumb_url" "text",
    "wiki_md" "text",
    "wiki_sort_order" integer,
    "is_published" boolean DEFAULT true NOT NULL,
    "published_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "display_name" "text",
    "item_count" integer,
    CONSTRAINT "wiki_collection_pages_code_not_blank" CHECK (("length"("btrim"("code")) > 0)),
    CONSTRAINT "wiki_collection_pages_collection_slug_not_blank" CHECK (("length"("btrim"("collection_slug")) > 0)),
    CONSTRAINT "wiki_collection_pages_display_name_not_blank" CHECK ((("display_name" IS NULL) OR ("length"("btrim"("display_name")) > 0))),
    CONSTRAINT "wiki_collection_pages_item_count_nonnegative" CHECK ((("item_count" IS NULL) OR ("item_count" >= 0))),
    CONSTRAINT "wiki_collection_pages_wiki_slug_not_blank" CHECK (("length"("btrim"("wiki_slug")) > 0))
);


ALTER TABLE "public"."wiki_collection_pages" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."wiki_collection_pages_view" WITH ("security_invoker"='true') AS
 SELECT "id",
    "wiki_page_id",
    "universe_id",
    "wiki_slug",
    "collection_slug",
    "code",
    "title",
    "display_name",
    "item_count",
    "seo_title",
    "meta_description",
    "intro_md",
    "how_it_works_md",
    "description_md",
    "description_json",
    "faq_json",
    "schema_ld_json",
    "thumb_url",
    "wiki_md",
    "wiki_sort_order",
    "is_published",
    "published_at",
    "created_at",
    "updated_at",
    GREATEST("updated_at", COALESCE("published_at", "updated_at")) AS "content_updated_at"
   FROM "public"."wiki_collection_pages" "wcp";


ALTER VIEW "public"."wiki_collection_pages_view" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."wiki_pages" (
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
    "cover_image" "text",
    "description_md" "text",
    CONSTRAINT "wiki_pages_slug_not_empty" CHECK (("length"(TRIM(BOTH FROM "slug")) > 0))
);


ALTER TABLE "public"."wiki_pages" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."wiki_pages_view" WITH ("security_invoker"='true') AS
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
    "wp"."cover_image",
    "wp"."description_md",
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
        CASE
            WHEN ("u"."last_playing_refreshed_at" >= ("now"() - '24:00:00'::interval)) THEN "u"."playing"
            ELSE NULL::bigint
        END AS "playing",
    "u"."visits",
    "u"."favorites",
    "u"."likes",
    "u"."dislikes",
    "u"."icon_url",
    "u"."thumbnail_urls",
    "u"."social_links",
    "u"."created_at_api",
    "u"."updated_at_api",
    "u"."updated_at" AS "universe_updated_at",
    "u"."last_playing_refreshed_at"
   FROM ("public"."wiki_pages" "wp"
     LEFT JOIN "public"."roblox_universes" "u" ON (("u"."universe_id" = "wp"."universe_id")));


ALTER VIEW "public"."wiki_pages_view" OWNER TO "postgres";


ALTER TABLE ONLY "public"."google_indexing_attempts" ALTER COLUMN "id" SET DEFAULT "nextval"('"public"."google_indexing_attempts_id_seq"'::"regclass");



ALTER TABLE ONLY "public"."app_sessions"
    ADD CONSTRAINT "app_sessions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."app_users"
    ADD CONSTRAINT "app_users_pkey" PRIMARY KEY ("user_id");



ALTER TABLE ONLY "public"."article_generation_artifacts"
    ADD CONSTRAINT "article_generation_artifacts_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."article_generation_queue"
    ADD CONSTRAINT "article_generation_queue_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."article_source_images"
    ADD CONSTRAINT "article_source_images_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."articles"
    ADD CONSTRAINT "articles_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."articles"
    ADD CONSTRAINT "articles_slug_key" UNIQUE ("slug");



ALTER TABLE ONLY "public"."authors"
    ADD CONSTRAINT "authors_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."authors"
    ADD CONSTRAINT "authors_slug_key" UNIQUE ("slug");



ALTER TABLE ONLY "public"."cache_warm_events"
    ADD CONSTRAINT "cache_warm_events_path_key" UNIQUE ("path");



ALTER TABLE ONLY "public"."cache_warm_events"
    ADD CONSTRAINT "cache_warm_events_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."cache_warm_worker_runs"
    ADD CONSTRAINT "cache_warm_worker_runs_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."catalog_pages"
    ADD CONSTRAINT "catalog_pages_code_key" UNIQUE ("code");



ALTER TABLE ONLY "public"."catalog_pages"
    ADD CONSTRAINT "catalog_pages_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."checklist_items"
    ADD CONSTRAINT "checklist_items_page_id_section_code_title_key" UNIQUE ("page_id", "section_code", "title");



ALTER TABLE ONLY "public"."checklist_items"
    ADD CONSTRAINT "checklist_items_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."checklist_pages"
    ADD CONSTRAINT "checklist_pages_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."checklist_pages"
    ADD CONSTRAINT "checklist_pages_universe_id_slug_key" UNIQUE ("universe_id", "slug");



ALTER TABLE ONLY "public"."code_pages"
    ADD CONSTRAINT "code_pages_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."code_pages"
    ADD CONSTRAINT "code_pages_slug_key" UNIQUE ("slug");



ALTER TABLE ONLY "public"."codes"
    ADD CONSTRAINT "codes_code_page_id_code_key" UNIQUE ("code_page_id", "code");



ALTER TABLE ONLY "public"."codes"
    ADD CONSTRAINT "codes_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."comments"
    ADD CONSTRAINT "comments_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."event_guide_generation_queue"
    ADD CONSTRAINT "event_guide_generation_queue_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."events_pages"
    ADD CONSTRAINT "events_pages_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."events_pages"
    ADD CONSTRAINT "events_pages_universe_id_key" UNIQUE ("universe_id");



ALTER TABLE ONLY "public"."game_generation_queue"
    ADD CONSTRAINT "game_generation_queue_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."google_indexing_attempts"
    ADD CONSTRAINT "google_indexing_attempts_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."google_indexing_url_state"
    ADD CONSTRAINT "google_indexing_url_state_pkey" PRIMARY KEY ("url", "notification_type");



ALTER TABLE ONLY "public"."puzzle_answers"
    ADD CONSTRAINT "puzzle_answers_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."puzzle_answers"
    ADD CONSTRAINT "puzzle_answers_puzzle_slug_answer_date_key" UNIQUE ("puzzle_slug", "answer_date");



ALTER TABLE ONLY "public"."puzzle_pages"
    ADD CONSTRAINT "puzzle_pages_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."puzzle_pages"
    ADD CONSTRAINT "puzzle_pages_slug_key" UNIQUE ("slug");



ALTER TABLE ONLY "public"."puzzle_sync_runs"
    ADD CONSTRAINT "puzzle_sync_runs_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."quiz_pages"
    ADD CONSTRAINT "quiz_pages_code_key" UNIQUE ("code");



ALTER TABLE ONLY "public"."quiz_pages"
    ADD CONSTRAINT "quiz_pages_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."revalidation_events"
    ADD CONSTRAINT "revalidation_events_entity_slug_key" UNIQUE ("entity_type", "slug");



ALTER TABLE ONLY "public"."revalidation_events"
    ADD CONSTRAINT "revalidation_events_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."revalidation_worker_runs"
    ADD CONSTRAINT "revalidation_worker_runs_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."roblox_catalog_categories"
    ADD CONSTRAINT "roblox_catalog_categories_pkey" PRIMARY KEY ("category");



ALTER TABLE ONLY "public"."roblox_catalog_discovery_hits"
    ADD CONSTRAINT "roblox_catalog_discovery_hits_pkey" PRIMARY KEY ("run_id", "asset_id");



ALTER TABLE ONLY "public"."roblox_catalog_discovery_runs"
    ADD CONSTRAINT "roblox_catalog_discovery_runs_pkey" PRIMARY KEY ("run_id");



ALTER TABLE ONLY "public"."roblox_catalog_item_images"
    ADD CONSTRAINT "roblox_catalog_item_images_pkey" PRIMARY KEY ("asset_id", "size", "format");



ALTER TABLE ONLY "public"."roblox_catalog_item_resale_points"
    ADD CONSTRAINT "roblox_catalog_item_resale_points_pkey" PRIMARY KEY ("asset_id", "point_date");



ALTER TABLE ONLY "public"."roblox_catalog_item_stats_daily"
    ADD CONSTRAINT "roblox_catalog_item_stats_daily_pkey" PRIMARY KEY ("asset_id", "stat_date");



ALTER TABLE ONLY "public"."roblox_catalog_item_stats_hourly"
    ADD CONSTRAINT "roblox_catalog_item_stats_hourly_pkey" PRIMARY KEY ("asset_id", "hour_start");



ALTER TABLE ONLY "public"."roblox_catalog_items_history"
    ADD CONSTRAINT "roblox_catalog_items_history_pkey" PRIMARY KEY ("asset_id", "recorded_at");



ALTER TABLE ONLY "public"."roblox_catalog_items"
    ADD CONSTRAINT "roblox_catalog_items_pkey" PRIMARY KEY ("asset_id");



ALTER TABLE ONLY "public"."roblox_catalog_refresh_queue"
    ADD CONSTRAINT "roblox_catalog_refresh_queue_pkey" PRIMARY KEY ("asset_id");



ALTER TABLE ONLY "public"."roblox_catalog_subcategories"
    ADD CONSTRAINT "roblox_catalog_subcategories_pkey" PRIMARY KEY ("subcategory");



ALTER TABLE ONLY "public"."roblox_decal_id_sources"
    ADD CONSTRAINT "roblox_decal_id_sources_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."roblox_decal_id_sources"
    ADD CONSTRAINT "roblox_decal_id_sources_unique_source" UNIQUE ("asset_id", "source_kind", "source_url", "source_query", "source_page", "source_rank");



ALTER TABLE ONLY "public"."roblox_decal_ids"
    ADD CONSTRAINT "roblox_decal_ids_pkey" PRIMARY KEY ("asset_id");



ALTER TABLE ONLY "public"."roblox_groups"
    ADD CONSTRAINT "roblox_groups_pkey" PRIMARY KEY ("group_id");



ALTER TABLE ONLY "public"."roblox_music_ids"
    ADD CONSTRAINT "roblox_music_ids_pkey" PRIMARY KEY ("asset_id");



ALTER TABLE ONLY "public"."roblox_promo_rewards"
    ADD CONSTRAINT "roblox_promo_rewards_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."roblox_promo_rewards"
    ADD CONSTRAINT "roblox_promo_rewards_source_unique" UNIQUE ("source_provider", "source_key");



ALTER TABLE ONLY "public"."roblox_universe_badges"
    ADD CONSTRAINT "roblox_universe_badges_pkey" PRIMARY KEY ("badge_id");



ALTER TABLE ONLY "public"."roblox_universe_gamepasses"
    ADD CONSTRAINT "roblox_universe_gamepasses_pkey" PRIMARY KEY ("pass_id");



ALTER TABLE ONLY "public"."roblox_universe_media"
    ADD CONSTRAINT "roblox_universe_media_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."roblox_universe_place_servers"
    ADD CONSTRAINT "roblox_universe_place_servers_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."roblox_universe_place_servers"
    ADD CONSTRAINT "roblox_universe_place_servers_place_id_server_id_fetched_at_key" UNIQUE ("place_id", "server_id", "fetched_at");



ALTER TABLE ONLY "public"."roblox_universe_rank_snapshots_daily"
    ADD CONSTRAINT "roblox_universe_rank_snapshots_daily_pkey" PRIMARY KEY ("universe_id", "rank_type", "stat_date");



ALTER TABLE ONLY "public"."roblox_universe_rank_snapshots_hourly"
    ADD CONSTRAINT "roblox_universe_rank_snapshots_hourly_pkey" PRIMARY KEY ("universe_id", "rank_type", "hour_start");



ALTER TABLE ONLY "public"."roblox_universe_rank_snapshots"
    ADD CONSTRAINT "roblox_universe_rank_snapshots_pkey" PRIMARY KEY ("universe_id", "rank_type", "sampled_at");



ALTER TABLE ONLY "public"."roblox_universe_social_links"
    ADD CONSTRAINT "roblox_universe_social_links_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."roblox_universe_social_links"
    ADD CONSTRAINT "roblox_universe_social_links_universe_id_platform_url_key" UNIQUE ("universe_id", "platform", "url");



ALTER TABLE ONLY "public"."roblox_universe_stats_daily"
    ADD CONSTRAINT "roblox_universe_stats_daily_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."roblox_universe_stats_daily"
    ADD CONSTRAINT "roblox_universe_stats_daily_universe_id_stat_date_key" UNIQUE ("universe_id", "stat_date");



ALTER TABLE ONLY "public"."roblox_universe_stats_hourly"
    ADD CONSTRAINT "roblox_universe_stats_hourly_pkey" PRIMARY KEY ("universe_id", "hour_start");



ALTER TABLE ONLY "public"."roblox_universe_update_events"
    ADD CONSTRAINT "roblox_universe_update_events_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."roblox_universe_update_events"
    ADD CONSTRAINT "roblox_universe_update_events_universe_id_updated_at_api_key" UNIQUE ("universe_id", "updated_at_api");



ALTER TABLE ONLY "public"."roblox_universes"
    ADD CONSTRAINT "roblox_universes_pkey" PRIMARY KEY ("universe_id");



ALTER TABLE ONLY "public"."roblox_virtual_event_categories"
    ADD CONSTRAINT "roblox_virtual_event_categories_pkey" PRIMARY KEY ("event_id", "rank");



ALTER TABLE ONLY "public"."roblox_virtual_event_thumbnails"
    ADD CONSTRAINT "roblox_virtual_event_thumbnails_pkey" PRIMARY KEY ("event_id", "rank");



ALTER TABLE ONLY "public"."roblox_virtual_events"
    ADD CONSTRAINT "roblox_virtual_events_pkey" PRIMARY KEY ("event_id");



ALTER TABLE ONLY "public"."search_index"
    ADD CONSTRAINT "search_index_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."site_feedback"
    ADD CONSTRAINT "site_feedback_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."stats_creator_current_index"
    ADD CONSTRAINT "stats_creator_current_index_creator_type_creator_id_key" UNIQUE ("creator_type", "creator_id");



ALTER TABLE ONLY "public"."stats_creator_current_index"
    ADD CONSTRAINT "stats_creator_current_index_pkey" PRIMARY KEY ("creator_key");



ALTER TABLE ONLY "public"."stats_game_current_index"
    ADD CONSTRAINT "stats_game_current_index_pkey" PRIMARY KEY ("universe_id");



ALTER TABLE ONLY "public"."stats_genre_current_index"
    ADD CONSTRAINT "stats_genre_current_index_pkey" PRIMARY KEY ("genre_slug");



ALTER TABLE ONLY "public"."stats_item_current_index"
    ADD CONSTRAINT "stats_item_current_index_pkey" PRIMARY KEY ("asset_id");



ALTER TABLE ONLY "public"."stats_item_price_movers_current_index"
    ADD CONSTRAINT "stats_item_price_movers_current_index_pkey" PRIMARY KEY ("asset_id");



ALTER TABLE ONLY "public"."stats_job_runs"
    ADD CONSTRAINT "stats_job_runs_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."stats_risers_current_index"
    ADD CONSTRAINT "stats_risers_current_index_pkey" PRIMARY KEY ("universe_id");



ALTER TABLE ONLY "public"."tools"
    ADD CONSTRAINT "tools_code_key" UNIQUE ("code");



ALTER TABLE ONLY "public"."tools"
    ADD CONSTRAINT "tools_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."user_checklist_progress"
    ADD CONSTRAINT "user_checklist_progress_pkey" PRIMARY KEY ("user_id", "checklist_slug");



ALTER TABLE ONLY "public"."user_code_progress"
    ADD CONSTRAINT "user_code_progress_pkey" PRIMARY KEY ("user_id", "game_slug");



ALTER TABLE ONLY "public"."user_quiz_progress"
    ADD CONSTRAINT "user_quiz_progress_pkey" PRIMARY KEY ("user_id", "quiz_code");



ALTER TABLE ONLY "public"."wiki_collection_pages"
    ADD CONSTRAINT "wiki_collection_pages_code_key" UNIQUE ("code");



ALTER TABLE ONLY "public"."wiki_collection_pages"
    ADD CONSTRAINT "wiki_collection_pages_path_key" UNIQUE ("wiki_slug", "collection_slug");



ALTER TABLE ONLY "public"."wiki_collection_pages"
    ADD CONSTRAINT "wiki_collection_pages_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."wiki_pages"
    ADD CONSTRAINT "wiki_pages_pkey" PRIMARY KEY ("id");



CREATE INDEX "idx_app_sessions_expires_at" ON "public"."app_sessions" USING "btree" ("expires_at");



CREATE INDEX "idx_app_sessions_revoked_at" ON "public"."app_sessions" USING "btree" ("revoked_at");



CREATE INDEX "idx_app_sessions_user_id" ON "public"."app_sessions" USING "btree" ("user_id");



CREATE UNIQUE INDEX "idx_app_users_roblox_user_id" ON "public"."app_users" USING "btree" ("roblox_user_id") WHERE ("roblox_user_id" IS NOT NULL);



CREATE INDEX "idx_app_users_role" ON "public"."app_users" USING "btree" ("role");



CREATE INDEX "idx_article_generation_artifacts_article" ON "public"."article_generation_artifacts" USING "btree" ("article_id", "created_at" DESC);



CREATE INDEX "idx_article_generation_artifacts_queue" ON "public"."article_generation_artifacts" USING "btree" ("queue_id", "created_at" DESC);



CREATE UNIQUE INDEX "idx_article_generation_queue_active_idempotency" ON "public"."article_generation_queue" USING "btree" ("idempotency_key") WHERE (("status" = ANY (ARRAY['pending'::"text", 'processing'::"text"])) AND ("event_id" IS NULL) AND ("idempotency_key" IS NOT NULL));



CREATE UNIQUE INDEX "idx_article_generation_queue_event_id" ON "public"."article_generation_queue" USING "btree" ("event_id") WHERE ("event_id" IS NOT NULL);



CREATE INDEX "idx_article_generation_queue_pending_backoff" ON "public"."article_generation_queue" USING "btree" ("status", "next_attempt_at", "created_at");



CREATE INDEX "idx_article_generation_queue_status_created" ON "public"."article_generation_queue" USING "btree" ("status", "created_at");



CREATE INDEX "idx_article_source_images_article" ON "public"."article_source_images" USING "btree" ("article_id");



CREATE INDEX "idx_article_source_images_source" ON "public"."article_source_images" USING "btree" ("source_host", "source_url");



CREATE INDEX "idx_articles_author" ON "public"."articles" USING "btree" ("author_id", "is_published");



CREATE INDEX "idx_articles_published" ON "public"."articles" USING "btree" ("is_published");



CREATE INDEX "idx_articles_published_published_at" ON "public"."articles" USING "btree" ("is_published", "published_at" DESC);



CREATE INDEX "idx_articles_slug" ON "public"."articles" USING "btree" ("lower"("slug"));



CREATE INDEX "idx_articles_universe" ON "public"."articles" USING "btree" ("universe_id");



CREATE INDEX "idx_cache_warm_events_priority_created" ON "public"."cache_warm_events" USING "btree" ("priority", "created_at");



CREATE INDEX "idx_cache_warm_events_updated" ON "public"."cache_warm_events" USING "btree" ("updated_at" DESC);



CREATE INDEX "idx_cache_warm_worker_runs_created" ON "public"."cache_warm_worker_runs" USING "btree" ("created_at" DESC);



CREATE INDEX "idx_cache_warm_worker_runs_status_created" ON "public"."cache_warm_worker_runs" USING "btree" ("status", "created_at" DESC);



CREATE INDEX "idx_catalog_pages_is_published" ON "public"."catalog_pages" USING "btree" ("is_published");



CREATE INDEX "idx_catalog_pages_universe_id" ON "public"."catalog_pages" USING "btree" ("universe_id");



CREATE INDEX "idx_catalog_pages_universe_wiki_sort" ON "public"."catalog_pages" USING "btree" ("universe_id", "wiki_sort_order") WHERE ("is_published" = true);



CREATE INDEX "idx_checklist_items_page" ON "public"."checklist_items" USING "btree" ("page_id");



CREATE INDEX "idx_checklist_items_page_section" ON "public"."checklist_items" USING "btree" ("page_id", "section_code");



CREATE INDEX "idx_checklist_pages_published" ON "public"."checklist_pages" USING "btree" ("is_public", "published_at" DESC NULLS LAST, "updated_at" DESC);



CREATE INDEX "idx_checklist_pages_universe_slug" ON "public"."checklist_pages" USING "btree" ("universe_id", "lower"("slug"));



CREATE INDEX "idx_code_pages_old_slugs" ON "public"."code_pages" USING "gin" ("old_slugs");



CREATE INDEX "idx_code_pages_published" ON "public"."code_pages" USING "btree" ("is_published");



CREATE INDEX "idx_code_pages_published_name" ON "public"."code_pages" USING "btree" ("is_published", "name");



CREATE INDEX "idx_code_pages_published_updated" ON "public"."code_pages" USING "btree" ("is_published", "updated_at" DESC);



CREATE INDEX "idx_code_pages_slug" ON "public"."code_pages" USING "btree" ("lower"("slug"));



CREATE INDEX "idx_code_pages_universe_id" ON "public"."code_pages" USING "btree" ("universe_id");



CREATE UNIQUE INDEX "idx_codes_code_page_code_upper" ON "public"."codes" USING "btree" ("code_page_id", "upper"("code"));



CREATE INDEX "idx_codes_code_page_first_seen" ON "public"."codes" USING "btree" ("code_page_id", "first_seen_at" DESC);



CREATE INDEX "idx_codes_code_page_status_seen" ON "public"."codes" USING "btree" ("code_page_id", "status", "last_seen_at" DESC);



CREATE INDEX "idx_codes_status_code_page" ON "public"."codes" USING "btree" ("status", "code_page_id");



CREATE INDEX "idx_comments_author" ON "public"."comments" USING "btree" ("author_id");



CREATE INDEX "idx_comments_entity_created" ON "public"."comments" USING "btree" ("entity_type", "entity_id", "created_at" DESC);



CREATE INDEX "idx_comments_page_type_created" ON "public"."comments" USING "btree" ("page_type", "created_at" DESC);



CREATE INDEX "idx_comments_parent" ON "public"."comments" USING "btree" ("parent_id");



CREATE UNIQUE INDEX "idx_event_guide_generation_queue_event_id" ON "public"."event_guide_generation_queue" USING "btree" ("event_id");



CREATE INDEX "idx_event_guide_generation_queue_status_created" ON "public"."event_guide_generation_queue" USING "btree" ("status", "created_at");



CREATE INDEX "idx_events_pages_is_published" ON "public"."events_pages" USING "btree" ("is_published");



CREATE UNIQUE INDEX "idx_events_pages_slug" ON "public"."events_pages" USING "btree" ("slug");



CREATE INDEX "idx_game_generation_queue_status_created" ON "public"."game_generation_queue" USING "btree" ("status", "created_at");



CREATE INDEX "idx_google_indexing_attempts_submitted_at" ON "public"."google_indexing_attempts" USING "btree" ("submitted_at" DESC);



CREATE INDEX "idx_google_indexing_attempts_type_submitted_at" ON "public"."google_indexing_attempts" USING "btree" ("notification_type", "submitted_at" DESC);



CREATE INDEX "idx_google_indexing_attempts_url" ON "public"."google_indexing_attempts" USING "btree" ("url");



CREATE INDEX "idx_google_indexing_url_state_last_submitted_at" ON "public"."google_indexing_url_state" USING "btree" ("notification_type", "last_submitted_at" NULLS FIRST);



CREATE INDEX "idx_item_resale_points_asset_date" ON "public"."roblox_catalog_item_resale_points" USING "btree" ("asset_id", "point_date" DESC);



CREATE INDEX "idx_item_resale_points_date" ON "public"."roblox_catalog_item_resale_points" USING "btree" ("point_date" DESC);



CREATE INDEX "idx_item_stats_daily_asset_date" ON "public"."roblox_catalog_item_stats_daily" USING "btree" ("asset_id", "stat_date" DESC);



CREATE INDEX "idx_item_stats_daily_date" ON "public"."roblox_catalog_item_stats_daily" USING "btree" ("stat_date" DESC);



CREATE INDEX "idx_item_stats_hourly_asset_hour" ON "public"."roblox_catalog_item_stats_hourly" USING "btree" ("asset_id", "hour_start" DESC);



CREATE INDEX "idx_item_stats_hourly_hour" ON "public"."roblox_catalog_item_stats_hourly" USING "btree" ("hour_start" DESC);



CREATE INDEX "idx_item_stats_hourly_resale" ON "public"."roblox_catalog_item_stats_hourly" USING "btree" ("lowest_resale_price_robux" DESC NULLS LAST, "hour_start" DESC);



CREATE INDEX "idx_puzzle_answers_fetched_at" ON "public"."puzzle_answers" USING "btree" ("fetched_at" DESC);



CREATE INDEX "idx_puzzle_answers_slug_date" ON "public"."puzzle_answers" USING "btree" ("puzzle_slug", "answer_date" DESC);



CREATE INDEX "idx_puzzle_pages_published_sort" ON "public"."puzzle_pages" USING "btree" ("is_published", "sort_order", "title");



CREATE INDEX "idx_puzzle_sync_runs_slug_ran_at" ON "public"."puzzle_sync_runs" USING "btree" ("puzzle_slug", "ran_at" DESC);



CREATE INDEX "idx_puzzle_sync_runs_status_ran_at" ON "public"."puzzle_sync_runs" USING "btree" ("status", "ran_at" DESC);



CREATE INDEX "idx_quiz_pages_is_published" ON "public"."quiz_pages" USING "btree" ("is_published", "published_at" DESC NULLS LAST, "updated_at" DESC);



CREATE INDEX "idx_quiz_pages_universe_id" ON "public"."quiz_pages" USING "btree" ("universe_id");



CREATE INDEX "idx_revalidation_events_created" ON "public"."revalidation_events" USING "btree" ("created_at" DESC);



CREATE INDEX "idx_revalidation_events_type_slug" ON "public"."revalidation_events" USING "btree" ("entity_type", "slug");



CREATE INDEX "idx_revalidation_worker_runs_started" ON "public"."revalidation_worker_runs" USING "btree" ("started_at" DESC);



CREATE INDEX "idx_revalidation_worker_runs_status_started" ON "public"."revalidation_worker_runs" USING "btree" ("status", "started_at" DESC);



CREATE INDEX "idx_roblox_catalog_discovery_hits_asset_id" ON "public"."roblox_catalog_discovery_hits" USING "btree" ("asset_id");



CREATE INDEX "idx_roblox_catalog_discovery_hits_query_hash" ON "public"."roblox_catalog_discovery_hits" USING "btree" ("query_hash");



CREATE INDEX "idx_roblox_catalog_discovery_runs_status" ON "public"."roblox_catalog_discovery_runs" USING "btree" ("status");



CREATE INDEX "idx_roblox_catalog_item_images_state" ON "public"."roblox_catalog_item_images" USING "btree" ("state");



CREATE INDEX "idx_roblox_catalog_items_asset_type_favorites" ON "public"."roblox_catalog_items" USING "btree" ("asset_type_id", "favorite_count" DESC NULLS LAST) WHERE ("is_deleted" = false);



CREATE INDEX "idx_roblox_catalog_items_asset_type_id" ON "public"."roblox_catalog_items" USING "btree" ("asset_type_id");



CREATE INDEX "idx_roblox_catalog_items_category" ON "public"."roblox_catalog_items" USING "btree" ("category");



CREATE INDEX "idx_roblox_catalog_items_category_subcategory_favorites" ON "public"."roblox_catalog_items" USING "btree" ("category", "subcategory", "favorite_count" DESC NULLS LAST) WHERE ("is_deleted" = false);



CREATE INDEX "idx_roblox_catalog_items_creator_id" ON "public"."roblox_catalog_items" USING "btree" ("creator_id");



CREATE INDEX "idx_roblox_catalog_items_creator_target_id" ON "public"."roblox_catalog_items" USING "btree" ("creator_target_id");



CREATE INDEX "idx_roblox_catalog_items_demand_level" ON "public"."roblox_catalog_items" USING "btree" ("demand_level", "trading_value" DESC NULLS LAST) WHERE (("is_limited" = true) OR ("is_limited_unique" = true));



CREATE INDEX "idx_roblox_catalog_items_history_asset" ON "public"."roblox_catalog_items_history" USING "btree" ("asset_id", "recorded_at" DESC);



CREATE INDEX "idx_roblox_catalog_items_history_recorded_at" ON "public"."roblox_catalog_items_history" USING "btree" ("recorded_at" DESC);



CREATE INDEX "idx_roblox_catalog_items_is_for_sale" ON "public"."roblox_catalog_items" USING "btree" ("is_for_sale");



CREATE INDEX "idx_roblox_catalog_items_is_limited" ON "public"."roblox_catalog_items" USING "btree" ("is_limited");



CREATE INDEX "idx_roblox_catalog_items_item_type" ON "public"."roblox_catalog_items" USING "btree" ("item_type");



CREATE INDEX "idx_roblox_catalog_items_last_seen_at" ON "public"."roblox_catalog_items" USING "btree" ("last_seen_at" DESC);



CREATE INDEX "idx_roblox_catalog_items_limited_tradeable" ON "public"."roblox_catalog_items" USING "btree" ("is_limited", "is_limited_unique", "trading_value" DESC NULLS LAST) WHERE ((("is_limited" = true) OR ("is_limited_unique" = true)) AND ("trading_value" IS NOT NULL));



CREATE INDEX "idx_roblox_catalog_items_price_robux" ON "public"."roblox_catalog_items" USING "btree" ("price_robux");



CREATE INDEX "idx_roblox_catalog_items_projected" ON "public"."roblox_catalog_items" USING "btree" ("is_projected", "trading_value" DESC NULLS LAST) WHERE (("is_limited" = true) OR ("is_limited_unique" = true));



CREATE INDEX "idx_roblox_catalog_items_rap" ON "public"."roblox_catalog_items" USING "btree" ("rap" DESC NULLS LAST) WHERE (("is_limited" = true) OR ("is_limited_unique" = true));



CREATE INDEX "idx_roblox_catalog_items_rap_last_fetched" ON "public"."roblox_catalog_items" USING "btree" ("rap_last_fetched" DESC NULLS LAST) WHERE (("is_limited" = true) OR ("is_limited_unique" = true));



CREATE INDEX "idx_roblox_catalog_items_resale_candidates" ON "public"."roblox_catalog_items" USING "btree" ("last_resale_data_fetched_at" NULLS FIRST, "lowest_resale_price_robux" DESC NULLS LAST, "asset_id") WHERE (("is_deleted" = false) AND (("has_resellers" = true) OR ("lowest_resale_price_robux" > 0) OR ("collectible_item_id" IS NOT NULL)));



CREATE INDEX "idx_roblox_catalog_items_stats_refresh_lease" ON "public"."roblox_catalog_items" USING "btree" ("item_stats_tier", "next_item_stats_refresh_at" NULLS FIRST, "item_stats_refresh_locked_at" NULLS FIRST, "last_item_stats_refreshed_at" NULLS FIRST, "asset_id") WHERE ("is_deleted" = false);



CREATE INDEX "idx_roblox_catalog_items_stats_tier_value" ON "public"."roblox_catalog_items" USING "btree" ("item_stats_tier", "favorite_count" DESC NULLS LAST, "lowest_resale_price_robux" DESC NULLS LAST, "asset_id") WHERE ("is_deleted" = false);



CREATE INDEX "idx_roblox_catalog_items_subcategory" ON "public"."roblox_catalog_items" USING "btree" ("subcategory");



CREATE INDEX "idx_roblox_catalog_items_trading_value" ON "public"."roblox_catalog_items" USING "btree" ("trading_value" DESC NULLS LAST) WHERE (("is_limited" = true) OR ("is_limited_unique" = true));



CREATE INDEX "idx_roblox_catalog_items_trend_direction" ON "public"."roblox_catalog_items" USING "btree" ("trend_direction", "trading_value" DESC NULLS LAST) WHERE (("is_limited" = true) OR ("is_limited_unique" = true));



CREATE INDEX "idx_roblox_catalog_items_verified_free" ON "public"."roblox_catalog_items" USING "btree" ("free_verified_at" DESC, "category", "subcategory", "favorite_count" DESC NULLS LAST) WHERE (("free_claimability" = 'direct'::"text") AND ("free_verification_source" = 'roblox'::"text") AND ("price_robux" = 0) AND ("is_for_sale" = true) AND ("is_deleted" = false));



CREATE INDEX "idx_roblox_catalog_refresh_queue_next_run_at" ON "public"."roblox_catalog_refresh_queue" USING "btree" ("next_run_at");



CREATE INDEX "idx_roblox_catalog_refresh_queue_priority" ON "public"."roblox_catalog_refresh_queue" USING "btree" ("priority");



CREATE INDEX "idx_roblox_catalog_subcategories_category" ON "public"."roblox_catalog_subcategories" USING "btree" ("category");



CREATE INDEX "idx_roblox_decal_id_sources_asset_id" ON "public"."roblox_decal_id_sources" USING "btree" ("asset_id");



CREATE INDEX "idx_roblox_decal_id_sources_kind" ON "public"."roblox_decal_id_sources" USING "btree" ("source_kind");



CREATE INDEX "idx_roblox_decal_ids_categories" ON "public"."roblox_decal_ids" USING "gin" ("categories");



CREATE INDEX "idx_roblox_decal_ids_creator" ON "public"."roblox_decal_ids" USING "btree" ("creator_type", "creator_id");



CREATE INDEX "idx_roblox_decal_ids_curated_rank" ON "public"."roblox_decal_ids" USING "btree" ("curated_rank");



CREATE INDEX "idx_roblox_decal_ids_curated_score" ON "public"."roblox_decal_ids" USING "btree" ("curated_score" DESC);



CREATE INDEX "idx_roblox_decal_ids_last_seen" ON "public"."roblox_decal_ids" USING "btree" ("last_seen_at" DESC);



CREATE INDEX "idx_roblox_decal_ids_popularity_score" ON "public"."roblox_decal_ids" USING "btree" ("popularity_score" DESC);



CREATE INDEX "idx_roblox_decal_ids_primary_category" ON "public"."roblox_decal_ids" USING "btree" ("primary_category");



CREATE INDEX "idx_roblox_decal_ids_public_categories" ON "public"."roblox_decal_ids" USING "gin" ("categories") WHERE (("status" = 'active'::"text") AND ("thumbnail_state" = 'Completed'::"text") AND ("thumbnail_url" IS NOT NULL));



CREATE INDEX "idx_roblox_decal_ids_public_creator" ON "public"."roblox_decal_ids" USING "btree" ("creator_name") WHERE (("status" = 'active'::"text") AND ("thumbnail_state" = 'Completed'::"text") AND ("thumbnail_url" IS NOT NULL));



CREATE INDEX "idx_roblox_decal_ids_public_curated" ON "public"."roblox_decal_ids" USING "btree" ("curated_rank", "curated_score" DESC NULLS LAST, "popularity_score" DESC NULLS LAST) WHERE (("status" = 'active'::"text") AND ("thumbnail_state" = 'Completed'::"text") AND ("thumbnail_url" IS NOT NULL) AND ("curated_rank" IS NOT NULL));



CREATE INDEX "idx_roblox_decal_ids_public_name" ON "public"."roblox_decal_ids" USING "btree" ("name") WHERE (("status" = 'active'::"text") AND ("thumbnail_state" = 'Completed'::"text") AND ("thumbnail_url" IS NOT NULL));



CREATE INDEX "idx_roblox_decal_ids_public_newest" ON "public"."roblox_decal_ids" USING "btree" ("roblox_created_at" DESC NULLS LAST) WHERE (("status" = 'active'::"text") AND ("thumbnail_state" = 'Completed'::"text") AND ("thumbnail_url" IS NOT NULL));



CREATE INDEX "idx_roblox_decal_ids_public_oldest" ON "public"."roblox_decal_ids" USING "btree" ("roblox_created_at") WHERE (("status" = 'active'::"text") AND ("thumbnail_state" = 'Completed'::"text") AND ("thumbnail_url" IS NOT NULL));



CREATE INDEX "idx_roblox_decal_ids_public_popular_votes" ON "public"."roblox_decal_ids" USING "btree" ("vote_count" DESC NULLS LAST, "popularity_score" DESC NULLS LAST, "last_seen_at" DESC NULLS LAST) WHERE (("status" = 'active'::"text") AND ("thumbnail_state" = 'Completed'::"text") AND ("thumbnail_url" IS NOT NULL));



CREATE INDEX "idx_roblox_decal_ids_public_recommended" ON "public"."roblox_decal_ids" USING "btree" ("curated_score" DESC NULLS LAST, "popularity_score" DESC NULLS LAST, "last_seen_at" DESC NULLS LAST, "verified_at" DESC NULLS LAST) WHERE (("status" = 'active'::"text") AND ("thumbnail_state" = 'Completed'::"text") AND ("thumbnail_url" IS NOT NULL));



CREATE INDEX "idx_roblox_decal_ids_public_recommended_rank" ON "public"."roblox_decal_ids" USING "btree" ("curated_rank", "curated_score" DESC NULLS LAST, "popularity_score" DESC NULLS LAST, "last_seen_at" DESC NULLS LAST) WHERE (("status" = 'active'::"text") AND ("thumbnail_state" = 'Completed'::"text") AND ("thumbnail_url" IS NOT NULL));



CREATE INDEX "idx_roblox_decal_ids_status" ON "public"."roblox_decal_ids" USING "btree" ("status");



CREATE INDEX "idx_roblox_decal_ids_thumbnail_checked_at" ON "public"."roblox_decal_ids" USING "btree" ("thumbnail_checked_at");



CREATE INDEX "idx_roblox_decal_ids_verified_at" ON "public"."roblox_decal_ids" USING "btree" ("verified_at");



CREATE INDEX "idx_roblox_music_ids_boombox_ready" ON "public"."roblox_music_ids" USING "btree" ("boombox_ready");



CREATE INDEX "idx_roblox_music_ids_last_seen" ON "public"."roblox_music_ids" USING "btree" ("last_seen_at" DESC);



CREATE INDEX "idx_roblox_music_ids_popularity_score" ON "public"."roblox_music_ids" USING "btree" ("popularity_score" DESC);



CREATE INDEX "idx_roblox_music_ids_rank" ON "public"."roblox_music_ids" USING "btree" ("rank");



CREATE INDEX "idx_roblox_music_ids_verified_at" ON "public"."roblox_music_ids" USING "btree" ("verified_at");



CREATE INDEX "idx_roblox_promo_rewards_asset_id" ON "public"."roblox_promo_rewards" USING "btree" ("asset_id");



CREATE INDEX "idx_roblox_promo_rewards_promo_code" ON "public"."roblox_promo_rewards" USING "btree" ("promo_code_normalized") WHERE ("promo_code_normalized" IS NOT NULL);



CREATE INDEX "idx_roblox_promo_rewards_sort_order" ON "public"."roblox_promo_rewards" USING "btree" ("sort_order", "reward_name");



CREATE INDEX "idx_roblox_promo_rewards_status_type_seen" ON "public"."roblox_promo_rewards" USING "btree" ("status", "claim_type", "last_seen_at" DESC);



CREATE INDEX "idx_roblox_rank_daily_universe_type_date_v2" ON "public"."roblox_universe_rank_snapshots_daily" USING "btree" ("universe_id", "rank_type", "stat_date" DESC);



CREATE INDEX "idx_roblox_rank_hourly_hour_v2" ON "public"."roblox_universe_rank_snapshots_hourly" USING "btree" ("hour_start");



CREATE INDEX "idx_roblox_rank_hourly_universe_type_hour_v2" ON "public"."roblox_universe_rank_snapshots_hourly" USING "btree" ("universe_id", "rank_type", "hour_start" DESC);



CREATE INDEX "idx_roblox_universe_badges" ON "public"."roblox_universe_badges" USING "btree" ("universe_id");



CREATE INDEX "idx_roblox_universe_gamepasses" ON "public"."roblox_universe_gamepasses" USING "btree" ("universe_id");



CREATE UNIQUE INDEX "idx_roblox_universe_media_unique_image" ON "public"."roblox_universe_media" USING "btree" ("universe_id", "media_type", "image_url") WHERE ("image_url" IS NOT NULL);



CREATE UNIQUE INDEX "idx_roblox_universe_media_unique_video" ON "public"."roblox_universe_media" USING "btree" ("universe_id", "media_type", "video_url") WHERE ("video_url" IS NOT NULL);



CREATE INDEX "idx_roblox_universe_media_universe" ON "public"."roblox_universe_media" USING "btree" ("universe_id", "media_type");



CREATE INDEX "idx_roblox_universe_place_servers_place" ON "public"."roblox_universe_place_servers" USING "btree" ("place_id", "fetched_at" DESC);



CREATE INDEX "idx_roblox_universe_place_servers_universe" ON "public"."roblox_universe_place_servers" USING "btree" ("universe_id", "fetched_at" DESC);



CREATE INDEX "idx_roblox_universe_rank_snapshots_type_time" ON "public"."roblox_universe_rank_snapshots" USING "btree" ("rank_type", "sampled_at" DESC, "rank_value");



CREATE INDEX "idx_roblox_universe_rank_snapshots_universe" ON "public"."roblox_universe_rank_snapshots" USING "btree" ("universe_id", "sampled_at" DESC);



CREATE INDEX "idx_roblox_universe_stats_daily" ON "public"."roblox_universe_stats_daily" USING "btree" ("universe_id", "stat_date" DESC);



CREATE INDEX "idx_roblox_universe_stats_hourly_hour" ON "public"."roblox_universe_stats_hourly" USING "btree" ("hour_start" DESC);



CREATE INDEX "idx_roblox_universe_stats_hourly_peak_playing" ON "public"."roblox_universe_stats_hourly" USING "btree" ("peak_playing" DESC, "hour_start" DESC);



CREATE INDEX "idx_roblox_universe_stats_hourly_playing" ON "public"."roblox_universe_stats_hourly" USING "btree" ("playing" DESC, "hour_start" DESC);



CREATE INDEX "idx_roblox_universe_stats_hourly_universe_hour" ON "public"."roblox_universe_stats_hourly" USING "btree" ("universe_id", "hour_start" DESC);



CREATE INDEX "idx_roblox_universe_update_events_detected" ON "public"."roblox_universe_update_events" USING "btree" ("detected_at" DESC);



CREATE INDEX "idx_roblox_universe_update_events_universe_updated" ON "public"."roblox_universe_update_events" USING "btree" ("universe_id", "updated_at_api" DESC);



CREATE INDEX "idx_roblox_universe_update_events_updated" ON "public"."roblox_universe_update_events" USING "btree" ("updated_at_api" DESC);



CREATE INDEX "idx_roblox_universes_creator" ON "public"."roblox_universes" USING "btree" ("creator_id");



CREATE INDEX "idx_roblox_universes_deep_enriched_stats_tier" ON "public"."roblox_universes" USING "btree" ("last_deep_enriched_at" NULLS FIRST, "stats_tier", "playing" DESC NULLS LAST, "visits" DESC NULLS LAST);



CREATE INDEX "idx_roblox_universes_display_name_trgm" ON "public"."roblox_universes" USING "gin" ("display_name" "extensions"."gin_trgm_ops");



CREATE INDEX "idx_roblox_universes_genre_playing_rank_v2" ON "public"."roblox_universes" USING "btree" ("genre_l1", "playing" DESC NULLS LAST, "universe_id") WHERE (("genre_l1" IS NOT NULL) AND ("playing" IS NOT NULL) AND (("stats_tier" IS NULL) OR ("stats_tier" <> 'NEW'::"text")));



CREATE INDEX "idx_roblox_universes_light_enriched" ON "public"."roblox_universes" USING "btree" ("last_light_enriched_at" NULLS FIRST, "last_seen_in_search" DESC NULLS LAST);



CREATE INDEX "idx_roblox_universes_new_refresh_v2" ON "public"."roblox_universes" USING "btree" ("last_stats_refreshed_at" NULLS FIRST, "universe_id") WHERE (("root_place_id" IS NOT NULL) AND (("stats_tier" = 'NEW'::"text") OR ("last_stats_refreshed_at" IS NULL) OR ("playing" IS NULL) OR ("visits" IS NULL)));



CREATE INDEX "idx_roblox_universes_rank_favorites_v2" ON "public"."roblox_universes" USING "btree" ("favorites" DESC NULLS LAST, "universe_id") WHERE (("favorites" IS NOT NULL) AND (("stats_tier" IS NULL) OR ("stats_tier" <> 'NEW'::"text")));



CREATE INDEX "idx_roblox_universes_rank_playing_v2" ON "public"."roblox_universes" USING "btree" ("playing" DESC NULLS LAST, "universe_id") WHERE (("playing" IS NOT NULL) AND (("stats_tier" IS NULL) OR ("stats_tier" <> 'NEW'::"text")));



CREATE INDEX "idx_roblox_universes_rank_rating_seed_v2" ON "public"."roblox_universes" USING "btree" ("likes" DESC NULLS LAST, "universe_id") WHERE (("likes" IS NOT NULL) AND (("stats_tier" IS NULL) OR ("stats_tier" <> 'NEW'::"text")));



CREATE INDEX "idx_roblox_universes_rank_visits_v2" ON "public"."roblox_universes" USING "btree" ("visits" DESC NULLS LAST, "universe_id") WHERE (("visits" IS NOT NULL) AND (("stats_tier" IS NULL) OR ("stats_tier" <> 'NEW'::"text")));



CREATE INDEX "idx_roblox_universes_seen" ON "public"."roblox_universes" USING "btree" (COALESCE("last_seen_in_sort", "last_seen_in_search") DESC);



CREATE INDEX "idx_roblox_universes_slug" ON "public"."roblox_universes" USING "btree" ("lower"("slug"));



CREATE INDEX "idx_roblox_universes_slug_trgm" ON "public"."roblox_universes" USING "gin" ("slug" "extensions"."gin_trgm_ops");



CREATE INDEX "idx_roblox_universes_stats_created" ON "public"."roblox_universes" USING "btree" ("created_at_api", "universe_id") WHERE ("slug" IS NOT NULL);



CREATE INDEX "idx_roblox_universes_stats_favorites" ON "public"."roblox_universes" USING "btree" ("favorites" DESC NULLS LAST, "universe_id") WHERE ("slug" IS NOT NULL);



CREATE INDEX "idx_roblox_universes_stats_genre_l1" ON "public"."roblox_universes" USING "btree" ("genre_l1", "genre") WHERE ("slug" IS NOT NULL);



CREATE INDEX "idx_roblox_universes_stats_genre_l1_playing" ON "public"."roblox_universes" USING "btree" ("genre_l1", "playing" DESC NULLS LAST, "universe_id") WHERE ("slug" IS NOT NULL);



CREATE INDEX "idx_roblox_universes_stats_genre_playing" ON "public"."roblox_universes" USING "btree" ("genre", "playing" DESC NULLS LAST, "universe_id") WHERE ("slug" IS NOT NULL);



CREATE INDEX "idx_roblox_universes_stats_ingest_status" ON "public"."roblox_universes" USING "btree" ("stats_ingest_status", "stats_ingest_status_updated_at" DESC) WHERE ("stats_tier" = 'NEW'::"text");



CREATE INDEX "idx_roblox_universes_stats_playing" ON "public"."roblox_universes" USING "btree" ("playing" DESC NULLS LAST, "universe_id") WHERE ("slug" IS NOT NULL);



CREATE INDEX "idx_roblox_universes_stats_refresh_lease" ON "public"."roblox_universes" USING "btree" ("stats_tier", "next_stats_refresh_at" NULLS FIRST, "stats_refresh_locked_at" NULLS FIRST, "last_stats_refreshed_at" NULLS FIRST, "universe_id") WHERE ("root_place_id" IS NOT NULL);



CREATE INDEX "idx_roblox_universes_stats_slug_universe" ON "public"."roblox_universes" USING "btree" ("universe_id") WHERE ("slug" IS NOT NULL);



CREATE INDEX "idx_roblox_universes_stats_tier_playing" ON "public"."roblox_universes" USING "btree" ("stats_tier", "playing" DESC NULLS LAST);



CREATE INDEX "idx_roblox_universes_stats_tier_refresh" ON "public"."roblox_universes" USING "btree" ("stats_tier", "last_stats_refreshed_at" NULLS FIRST, "playing" DESC NULLS LAST, "visits" DESC NULLS LAST);



CREATE INDEX "idx_roblox_universes_stats_tier_refresh_v2" ON "public"."roblox_universes" USING "btree" ("stats_tier", "last_stats_refreshed_at" NULLS FIRST, "last_playing_refreshed_at" NULLS FIRST, "playing" DESC NULLS LAST, "visits" DESC NULLS LAST, "universe_id") WHERE ("root_place_id" IS NOT NULL);



CREATE INDEX "idx_roblox_universes_stats_tier_visits" ON "public"."roblox_universes" USING "btree" ("stats_tier", "visits" DESC NULLS LAST);



CREATE INDEX "idx_roblox_universes_stats_updated" ON "public"."roblox_universes" USING "btree" ("updated_at_api" DESC NULLS LAST, "universe_id") WHERE ("slug" IS NOT NULL);



CREATE INDEX "idx_roblox_universes_stats_visits" ON "public"."roblox_universes" USING "btree" ("visits" DESC NULLS LAST, "universe_id") WHERE ("slug" IS NOT NULL);



CREATE INDEX "idx_roblox_universes_subgenre_playing_rank_v2" ON "public"."roblox_universes" USING "btree" ("genre_l2", "playing" DESC NULLS LAST, "universe_id") WHERE (("genre_l2" IS NOT NULL) AND ("playing" IS NOT NULL) AND (("stats_tier" IS NULL) OR ("stats_tier" <> 'NEW'::"text")));



CREATE INDEX "idx_roblox_universes_tier_deep_enrichment_v2" ON "public"."roblox_universes" USING "btree" ("stats_tier", "last_deep_enriched_at" NULLS FIRST, "universe_id") WHERE ("root_place_id" IS NOT NULL);



CREATE INDEX "idx_roblox_universes_tier_light_enrichment_v2" ON "public"."roblox_universes" USING "btree" ("stats_tier", "last_light_enriched_at" NULLS FIRST, "universe_id") WHERE ("root_place_id" IS NOT NULL);



CREATE INDEX "idx_roblox_virtual_events_event_status" ON "public"."roblox_virtual_events" USING "btree" ("event_status");



CREATE INDEX "idx_roblox_virtual_events_first_live_at" ON "public"."roblox_virtual_events" USING "btree" ("first_live_at");



CREATE INDEX "idx_roblox_virtual_events_start_utc" ON "public"."roblox_virtual_events" USING "btree" ("start_utc");



CREATE INDEX "idx_roblox_virtual_events_universe_id" ON "public"."roblox_virtual_events" USING "btree" ("universe_id");



CREATE INDEX "idx_roblox_virtual_events_universe_range_v2" ON "public"."roblox_virtual_events" USING "btree" ("universe_id", "start_utc", "end_utc");



CREATE UNIQUE INDEX "idx_search_index_entity" ON "public"."search_index" USING "btree" ("entity_type", "entity_id");



CREATE INDEX "idx_search_index_published_updated" ON "public"."search_index" USING "btree" ("is_published", "updated_at" DESC);



CREATE INDEX "idx_search_index_search_text_trgm" ON "public"."search_index" USING "gin" ("search_text" "extensions"."gin_trgm_ops");



CREATE INDEX "idx_search_index_type_slug" ON "public"."search_index" USING "btree" ("entity_type", "slug");



CREATE INDEX "idx_search_index_vector" ON "public"."search_index" USING "gin" ("search_vector");



CREATE INDEX "idx_site_feedback_created_at" ON "public"."site_feedback" USING "btree" ("created_at" DESC);



CREATE INDEX "idx_site_feedback_status_created_at" ON "public"."site_feedback" USING "btree" ("status", "created_at" DESC);



CREATE INDEX "idx_stats_creator_current_favorites" ON "public"."stats_creator_current_index" USING "btree" ("favorites" DESC, "creator_key");



CREATE INDEX "idx_stats_creator_current_games" ON "public"."stats_creator_current_index" USING "btree" ("game_count" DESC, "playing" DESC, "creator_key");



CREATE INDEX "idx_stats_creator_current_hot_games" ON "public"."stats_creator_current_index" USING "btree" ("hot_game_count" DESC, "playing" DESC, "creator_key");



CREATE INDEX "idx_stats_creator_current_members" ON "public"."stats_creator_current_index" USING "btree" ("member_count" DESC NULLS LAST, "playing" DESC, "creator_key");



CREATE INDEX "idx_stats_creator_current_name_trgm" ON "public"."stats_creator_current_index" USING "gin" ("creator_name" "extensions"."gin_trgm_ops");



CREATE INDEX "idx_stats_creator_current_playing" ON "public"."stats_creator_current_index" USING "btree" ("playing" DESC, "creator_key");



CREATE INDEX "idx_stats_creator_current_visits" ON "public"."stats_creator_current_index" USING "btree" ("visits" DESC, "creator_key");



CREATE INDEX "idx_stats_game_current_created" ON "public"."stats_game_current_index" USING "btree" ("created_at_api", "universe_id");



CREATE INDEX "idx_stats_game_current_creator_name_trgm" ON "public"."stats_game_current_index" USING "gin" ("creator_name" "extensions"."gin_trgm_ops");



CREATE INDEX "idx_stats_game_current_display_name_trgm" ON "public"."stats_game_current_index" USING "gin" ("display_name" "extensions"."gin_trgm_ops");



CREATE INDEX "idx_stats_game_current_favorites" ON "public"."stats_game_current_index" USING "btree" ("favorites" DESC NULLS LAST, "universe_id");



CREATE INDEX "idx_stats_game_current_genre" ON "public"."stats_game_current_index" USING "btree" ("genre_l1", "playing" DESC NULLS LAST, "universe_id");



CREATE INDEX "idx_stats_game_current_growth_24h" ON "public"."stats_game_current_index" USING "btree" ("growth_24h" DESC NULLS LAST, "playing" DESC NULLS LAST, "universe_id");



CREATE INDEX "idx_stats_game_current_growth_7d" ON "public"."stats_game_current_index" USING "btree" ("growth_7d" DESC NULLS LAST, "playing" DESC NULLS LAST, "universe_id");



CREATE INDEX "idx_stats_game_current_name_trgm" ON "public"."stats_game_current_index" USING "gin" ("name" "extensions"."gin_trgm_ops");



CREATE INDEX "idx_stats_game_current_peak_24h" ON "public"."stats_game_current_index" USING "btree" ("peak_24h" DESC NULLS LAST, "playing" DESC NULLS LAST, "universe_id");



CREATE INDEX "idx_stats_game_current_playing" ON "public"."stats_game_current_index" USING "btree" ("playing" DESC NULLS LAST, "universe_id");



CREATE INDEX "idx_stats_game_current_rating" ON "public"."stats_game_current_index" USING "btree" ("rating_percent" DESC NULLS LAST, "playing" DESC NULLS LAST, "universe_id");



CREATE INDEX "idx_stats_game_current_updated" ON "public"."stats_game_current_index" USING "btree" ("updated_at_api" DESC NULLS LAST, "universe_id");



CREATE INDEX "idx_stats_game_current_visits" ON "public"."stats_game_current_index" USING "btree" ("visits" DESC NULLS LAST, "universe_id");



CREATE INDEX "idx_stats_genre_current_playing" ON "public"."stats_genre_current_index" USING "btree" ("playing" DESC, "genre");



CREATE INDEX "idx_stats_item_current_category" ON "public"."stats_item_current_index" USING "btree" ("category", "subcategory", "favorite_count" DESC NULLS LAST, "asset_id");



CREATE INDEX "idx_stats_item_current_creator" ON "public"."stats_item_current_index" USING "btree" ("creator_name", "favorite_count" DESC NULLS LAST, "asset_id");



CREATE INDEX "idx_stats_item_current_creator_name_trgm" ON "public"."stats_item_current_index" USING "gin" ("creator_name" "extensions"."gin_trgm_ops");



CREATE INDEX "idx_stats_item_current_description_trgm" ON "public"."stats_item_current_index" USING "gin" ("description" "extensions"."gin_trgm_ops");



CREATE INDEX "idx_stats_item_current_favorites" ON "public"."stats_item_current_index" USING "btree" ("favorite_count" DESC NULLS LAST, "asset_id");



CREATE INDEX "idx_stats_item_current_name_trgm" ON "public"."stats_item_current_index" USING "gin" ("name" "extensions"."gin_trgm_ops");



CREATE INDEX "idx_stats_item_current_price_high" ON "public"."stats_item_current_index" USING "btree" ("price_robux" DESC NULLS LAST, "favorite_count" DESC NULLS LAST, "asset_id");



CREATE INDEX "idx_stats_item_current_price_low" ON "public"."stats_item_current_index" USING "btree" ("price_robux", "favorite_count" DESC NULLS LAST, "asset_id");



CREATE INDEX "idx_stats_item_current_resale_low" ON "public"."stats_item_current_index" USING "btree" ("lowest_resale_price_robux", "favorite_count" DESC NULLS LAST, "asset_id") WHERE (("has_resellers" = true) AND ("lowest_resale_price_robux" > 0));



CREATE INDEX "idx_stats_item_current_seen" ON "public"."stats_item_current_index" USING "btree" ("last_seen_at" DESC NULLS LAST, "asset_id");



CREATE INDEX "idx_stats_item_current_tier" ON "public"."stats_item_current_index" USING "btree" ("item_stats_tier", "last_item_stats_refreshed_at" DESC NULLS LAST, "asset_id");



CREATE INDEX "idx_stats_item_price_movers_rank" ON "public"."stats_item_price_movers_current_index" USING "btree" ("rank_value");



CREATE INDEX "idx_stats_item_price_movers_score" ON "public"."stats_item_price_movers_current_index" USING "btree" ("mover_score" DESC, "asset_id");



CREATE INDEX "idx_stats_job_runs_job_started" ON "public"."stats_job_runs" USING "btree" ("job_name", "started_at" DESC);



CREATE INDEX "idx_stats_job_runs_status_started" ON "public"."stats_job_runs" USING "btree" ("status", "started_at" DESC);



CREATE INDEX "idx_stats_risers_current_rank" ON "public"."stats_risers_current_index" USING "btree" ("rank_value");



CREATE INDEX "idx_stats_risers_current_score" ON "public"."stats_risers_current_index" USING "btree" ("riser_score" DESC, "growth_24h" DESC, "playing" DESC);



CREATE INDEX "idx_tools_is_published" ON "public"."tools" USING "btree" ("is_published");



CREATE INDEX "idx_user_checklist_progress_slug" ON "public"."user_checklist_progress" USING "btree" ("checklist_slug");



CREATE INDEX "idx_user_code_progress_slug" ON "public"."user_code_progress" USING "btree" ("game_slug");



CREATE INDEX "idx_user_quiz_progress_code" ON "public"."user_quiz_progress" USING "btree" ("quiz_code");



CREATE INDEX "idx_wiki_collection_pages_is_published" ON "public"."wiki_collection_pages" USING "btree" ("is_published");



CREATE INDEX "idx_wiki_collection_pages_universe_id" ON "public"."wiki_collection_pages" USING "btree" ("universe_id");



CREATE INDEX "idx_wiki_collection_pages_wiki_sort" ON "public"."wiki_collection_pages" USING "btree" ("wiki_slug", "wiki_sort_order") WHERE ("is_published" = true);



CREATE INDEX "idx_wiki_pages_published" ON "public"."wiki_pages" USING "btree" ("is_published", "published_at" DESC NULLS LAST, "updated_at" DESC);



CREATE UNIQUE INDEX "idx_wiki_pages_slug_lower" ON "public"."wiki_pages" USING "btree" ("lower"("slug"));



CREATE INDEX "idx_wiki_pages_universe_id" ON "public"."wiki_pages" USING "btree" ("universe_id");



CREATE OR REPLACE TRIGGER "trg_app_sessions_updated_at" BEFORE UPDATE ON "public"."app_sessions" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "trg_app_users_updated_at" BEFORE UPDATE ON "public"."app_users" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "trg_article_generation_artifacts_updated_at" BEFORE UPDATE ON "public"."article_generation_artifacts" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "trg_article_generation_queue_idempotency_key" BEFORE INSERT OR UPDATE OF "article_title", "universe_id" ON "public"."article_generation_queue" FOR EACH ROW EXECUTE FUNCTION "public"."set_article_generation_queue_idempotency_key"();



CREATE OR REPLACE TRIGGER "trg_article_generation_queue_updated_at" BEFORE UPDATE ON "public"."article_generation_queue" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "trg_articles_updated_at" BEFORE UPDATE ON "public"."articles" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "trg_authors_updated_at" BEFORE UPDATE ON "public"."authors" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "trg_canonicalize_article_media" BEFORE INSERT OR UPDATE ON "public"."articles" FOR EACH ROW EXECUTE FUNCTION "public"."trg_canonicalize_article_media"();



CREATE OR REPLACE TRIGGER "trg_canonicalize_article_source_media" BEFORE INSERT OR UPDATE ON "public"."article_source_images" FOR EACH ROW EXECUTE FUNCTION "public"."trg_canonicalize_article_source_media"();



CREATE OR REPLACE TRIGGER "trg_canonicalize_code_page_media" BEFORE INSERT OR UPDATE ON "public"."code_pages" FOR EACH ROW EXECUTE FUNCTION "public"."trg_canonicalize_code_page_media"();



CREATE OR REPLACE TRIGGER "trg_catalog_pages_updated_at" BEFORE UPDATE ON "public"."catalog_pages" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "trg_checklist_items_normalize" BEFORE INSERT OR UPDATE ON "public"."checklist_items" FOR EACH ROW EXECUTE FUNCTION "public"."trg_normalize_section_code"();



CREATE OR REPLACE TRIGGER "trg_checklist_items_updated_at" BEFORE UPDATE ON "public"."checklist_items" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "trg_checklist_pages_updated_at" BEFORE UPDATE ON "public"."checklist_pages" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "trg_code_pages_updated_at" BEFORE UPDATE ON "public"."code_pages" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "trg_comments_revalidate_entity" AFTER INSERT OR DELETE OR UPDATE ON "public"."comments" FOR EACH ROW EXECUTE FUNCTION "public"."trg_comments_revalidate_entity"();



CREATE OR REPLACE TRIGGER "trg_comments_updated_at" BEFORE UPDATE ON "public"."comments" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "trg_enqueue_revalidation_articles" AFTER INSERT OR DELETE OR UPDATE ON "public"."articles" FOR EACH ROW EXECUTE FUNCTION "public"."trg_enqueue_revalidation_articles"();



CREATE OR REPLACE TRIGGER "trg_enqueue_revalidation_avatar_catalog_images" AFTER INSERT OR DELETE OR UPDATE ON "public"."roblox_catalog_item_images" FOR EACH ROW EXECUTE FUNCTION "public"."trg_enqueue_revalidation_avatar_catalog_images"();



CREATE OR REPLACE TRIGGER "trg_enqueue_revalidation_avatar_catalog_items" AFTER INSERT OR DELETE OR UPDATE ON "public"."roblox_catalog_items" FOR EACH ROW EXECUTE FUNCTION "public"."trg_enqueue_revalidation_avatar_catalog_items"();



CREATE OR REPLACE TRIGGER "trg_enqueue_revalidation_catalog_pages" AFTER INSERT OR DELETE OR UPDATE ON "public"."catalog_pages" FOR EACH ROW EXECUTE FUNCTION "public"."trg_enqueue_revalidation_catalog_pages"();



CREATE OR REPLACE TRIGGER "trg_enqueue_revalidation_checklist_items" AFTER INSERT OR DELETE OR UPDATE ON "public"."checklist_items" FOR EACH ROW EXECUTE FUNCTION "public"."trg_enqueue_revalidation_checklist_items"();



CREATE OR REPLACE TRIGGER "trg_enqueue_revalidation_checklist_pages" AFTER INSERT OR DELETE OR UPDATE ON "public"."checklist_pages" FOR EACH ROW EXECUTE FUNCTION "public"."trg_enqueue_revalidation_checklist_pages"();



CREATE OR REPLACE TRIGGER "trg_enqueue_revalidation_code_pages" AFTER INSERT OR DELETE OR UPDATE ON "public"."code_pages" FOR EACH ROW EXECUTE FUNCTION "public"."trg_enqueue_revalidation_code_pages"();



CREATE OR REPLACE TRIGGER "trg_enqueue_revalidation_codes" AFTER INSERT OR DELETE OR UPDATE ON "public"."codes" FOR EACH ROW EXECUTE FUNCTION "public"."trg_enqueue_revalidation_codes"();



CREATE OR REPLACE TRIGGER "trg_enqueue_revalidation_decal_ids" AFTER INSERT OR DELETE OR UPDATE ON "public"."roblox_decal_ids" FOR EACH ROW EXECUTE FUNCTION "public"."trg_enqueue_revalidation_decal_ids"();



CREATE OR REPLACE TRIGGER "trg_enqueue_revalidation_events_pages" AFTER INSERT OR DELETE OR UPDATE ON "public"."events_pages" FOR EACH ROW EXECUTE FUNCTION "public"."trg_enqueue_revalidation_events_pages"();



CREATE OR REPLACE TRIGGER "trg_enqueue_revalidation_free_item_images" AFTER INSERT OR DELETE OR UPDATE ON "public"."roblox_catalog_item_images" FOR EACH ROW EXECUTE FUNCTION "public"."trg_enqueue_revalidation_free_item_images"();



CREATE OR REPLACE TRIGGER "trg_enqueue_revalidation_free_items_catalog" AFTER INSERT OR DELETE OR UPDATE ON "public"."roblox_catalog_items" FOR EACH ROW EXECUTE FUNCTION "public"."trg_enqueue_revalidation_free_items_catalog"();



CREATE OR REPLACE TRIGGER "trg_enqueue_revalidation_music_ids" AFTER INSERT OR DELETE OR UPDATE ON "public"."roblox_music_ids" FOR EACH ROW EXECUTE FUNCTION "public"."trg_enqueue_revalidation_music_ids"();



CREATE OR REPLACE TRIGGER "trg_enqueue_revalidation_promo_rewards" AFTER INSERT OR DELETE OR UPDATE ON "public"."roblox_promo_rewards" FOR EACH ROW EXECUTE FUNCTION "public"."trg_enqueue_revalidation_promo_rewards"();



CREATE OR REPLACE TRIGGER "trg_enqueue_revalidation_puzzle_answers" AFTER INSERT OR DELETE OR UPDATE ON "public"."puzzle_answers" FOR EACH ROW EXECUTE FUNCTION "public"."trg_enqueue_revalidation_puzzle_answers"();



CREATE OR REPLACE TRIGGER "trg_enqueue_revalidation_puzzle_pages" AFTER INSERT OR DELETE OR UPDATE ON "public"."puzzle_pages" FOR EACH ROW EXECUTE FUNCTION "public"."trg_enqueue_revalidation_puzzle_pages"();



CREATE OR REPLACE TRIGGER "trg_enqueue_revalidation_quiz_pages" AFTER INSERT OR DELETE OR UPDATE ON "public"."quiz_pages" FOR EACH ROW EXECUTE FUNCTION "public"."trg_enqueue_revalidation_quiz_pages"();



CREATE OR REPLACE TRIGGER "trg_enqueue_revalidation_stats_items_catalog_images" AFTER INSERT OR DELETE OR UPDATE ON "public"."roblox_catalog_item_images" FOR EACH ROW EXECUTE FUNCTION "public"."trg_enqueue_revalidation_stats_items"();



CREATE OR REPLACE TRIGGER "trg_enqueue_revalidation_stats_items_catalog_items" AFTER INSERT OR DELETE OR UPDATE ON "public"."roblox_catalog_items" FOR EACH ROW EXECUTE FUNCTION "public"."trg_enqueue_revalidation_stats_items"();



CREATE OR REPLACE TRIGGER "trg_enqueue_revalidation_tools" AFTER INSERT OR DELETE OR UPDATE ON "public"."tools" FOR EACH ROW EXECUTE FUNCTION "public"."trg_enqueue_revalidation_tools"();



CREATE OR REPLACE TRIGGER "trg_enqueue_revalidation_virtual_event_categories" AFTER INSERT OR DELETE OR UPDATE ON "public"."roblox_virtual_event_categories" FOR EACH ROW EXECUTE FUNCTION "public"."trg_enqueue_revalidation_virtual_event_assets"();



CREATE OR REPLACE TRIGGER "trg_enqueue_revalidation_virtual_event_thumbnails" AFTER INSERT OR DELETE OR UPDATE ON "public"."roblox_virtual_event_thumbnails" FOR EACH ROW EXECUTE FUNCTION "public"."trg_enqueue_revalidation_virtual_event_assets"();



CREATE OR REPLACE TRIGGER "trg_enqueue_revalidation_virtual_events" AFTER INSERT OR DELETE OR UPDATE ON "public"."roblox_virtual_events" FOR EACH ROW EXECUTE FUNCTION "public"."trg_enqueue_revalidation_virtual_events"();



CREATE OR REPLACE TRIGGER "trg_enqueue_revalidation_wiki_collection_pages" AFTER INSERT OR DELETE OR UPDATE ON "public"."wiki_collection_pages" FOR EACH ROW EXECUTE FUNCTION "public"."trg_enqueue_revalidation_wiki_collection_pages"();



CREATE OR REPLACE TRIGGER "trg_enqueue_revalidation_wiki_pages" AFTER INSERT OR DELETE OR UPDATE ON "public"."wiki_pages" FOR EACH ROW EXECUTE FUNCTION "public"."trg_enqueue_revalidation_wiki_pages"();



CREATE OR REPLACE TRIGGER "trg_enqueue_revalidation_wiki_roblox_universes" AFTER INSERT OR DELETE OR UPDATE ON "public"."roblox_universes" FOR EACH ROW EXECUTE FUNCTION "public"."trg_enqueue_revalidation_wiki_universe"();



CREATE OR REPLACE TRIGGER "trg_enqueue_revalidation_wiki_universe_badges" AFTER INSERT OR DELETE OR UPDATE ON "public"."roblox_universe_badges" FOR EACH ROW EXECUTE FUNCTION "public"."trg_enqueue_revalidation_wiki_universe"();



CREATE OR REPLACE TRIGGER "trg_enqueue_revalidation_wiki_universe_gamepasses" AFTER INSERT OR DELETE OR UPDATE ON "public"."roblox_universe_gamepasses" FOR EACH ROW EXECUTE FUNCTION "public"."trg_enqueue_revalidation_wiki_universe"();



CREATE OR REPLACE TRIGGER "trg_enqueue_revalidation_wiki_universe_media" AFTER INSERT OR DELETE OR UPDATE ON "public"."roblox_universe_media" FOR EACH ROW EXECUTE FUNCTION "public"."trg_enqueue_revalidation_wiki_universe"();



CREATE OR REPLACE TRIGGER "trg_enqueue_revalidation_wiki_universe_place_servers" AFTER INSERT OR DELETE OR UPDATE ON "public"."roblox_universe_place_servers" FOR EACH ROW EXECUTE FUNCTION "public"."trg_enqueue_revalidation_wiki_universe"();



CREATE OR REPLACE TRIGGER "trg_enqueue_revalidation_wiki_universe_social_links" AFTER INSERT OR DELETE OR UPDATE ON "public"."roblox_universe_social_links" FOR EACH ROW EXECUTE FUNCTION "public"."trg_enqueue_revalidation_wiki_universe"();



CREATE OR REPLACE TRIGGER "trg_event_guide_generation_queue_updated_at" BEFORE UPDATE ON "public"."event_guide_generation_queue" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "trg_events_pages_updated_at" BEFORE UPDATE ON "public"."events_pages" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "trg_game_generation_queue_updated_at" BEFORE UPDATE ON "public"."game_generation_queue" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "trg_google_indexing_url_state_updated_at" BEFORE UPDATE ON "public"."google_indexing_url_state" FOR EACH ROW EXECUTE FUNCTION "public"."set_google_indexing_url_state_updated_at"();



CREATE OR REPLACE TRIGGER "trg_puzzle_answers_updated_at" BEFORE UPDATE ON "public"."puzzle_answers" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "trg_puzzle_pages_updated_at" BEFORE UPDATE ON "public"."puzzle_pages" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "trg_quiz_pages_updated_at" BEFORE UPDATE ON "public"."quiz_pages" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "trg_refresh_search_index_music" AFTER INSERT OR DELETE OR UPDATE ON "public"."roblox_music_ids" FOR EACH STATEMENT EXECUTE FUNCTION "public"."trg_refresh_search_index_music"();



CREATE OR REPLACE TRIGGER "trg_roblox_catalog_categories_updated_at" BEFORE UPDATE ON "public"."roblox_catalog_categories" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "trg_roblox_catalog_discovery_runs_updated_at" BEFORE UPDATE ON "public"."roblox_catalog_discovery_runs" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "trg_roblox_catalog_item_images_updated_at" BEFORE UPDATE ON "public"."roblox_catalog_item_images" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "trg_roblox_catalog_items_updated_at" BEFORE UPDATE ON "public"."roblox_catalog_items" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "trg_roblox_catalog_refresh_queue_updated_at" BEFORE UPDATE ON "public"."roblox_catalog_refresh_queue" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "trg_roblox_catalog_subcategories_updated_at" BEFORE UPDATE ON "public"."roblox_catalog_subcategories" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "trg_roblox_decal_id_sources_updated_at" BEFORE UPDATE ON "public"."roblox_decal_id_sources" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "trg_roblox_decal_ids_updated_at" BEFORE UPDATE ON "public"."roblox_decal_ids" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "trg_roblox_music_ids_updated_at" BEFORE UPDATE ON "public"."roblox_music_ids" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "trg_roblox_promo_rewards_updated_at" BEFORE UPDATE ON "public"."roblox_promo_rewards" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "trg_roblox_universe_stats_hourly_updated_at" BEFORE UPDATE ON "public"."roblox_universe_stats_hourly" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "trg_roblox_universes_updated_at" BEFORE UPDATE ON "public"."roblox_universes" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "trg_sanitize_stats_creator_top_player" BEFORE INSERT OR UPDATE ON "public"."stats_creator_current_index" FOR EACH ROW EXECUTE FUNCTION "public"."sanitize_stats_creator_top_player"();



CREATE OR REPLACE TRIGGER "trg_sanitize_stats_game_current_player" BEFORE INSERT OR UPDATE ON "public"."stats_game_current_index" FOR EACH ROW EXECUTE FUNCTION "public"."sanitize_stats_game_current_player"();



CREATE OR REPLACE TRIGGER "trg_search_index_articles" AFTER INSERT OR DELETE OR UPDATE ON "public"."articles" FOR EACH ROW EXECUTE FUNCTION "public"."trg_search_index_articles"();



CREATE OR REPLACE TRIGGER "trg_search_index_authors" AFTER INSERT OR DELETE OR UPDATE ON "public"."authors" FOR EACH ROW EXECUTE FUNCTION "public"."trg_search_index_authors"();



CREATE OR REPLACE TRIGGER "trg_search_index_catalog_pages" AFTER INSERT OR DELETE OR UPDATE ON "public"."catalog_pages" FOR EACH ROW EXECUTE FUNCTION "public"."trg_search_index_catalog_pages"();



CREATE OR REPLACE TRIGGER "trg_search_index_checklists" AFTER INSERT OR DELETE OR UPDATE ON "public"."checklist_pages" FOR EACH ROW EXECUTE FUNCTION "public"."trg_search_index_checklists"();



CREATE OR REPLACE TRIGGER "trg_search_index_code_pages" AFTER INSERT OR DELETE OR UPDATE ON "public"."code_pages" FOR EACH ROW EXECUTE FUNCTION "public"."trg_search_index_code_pages"();



CREATE OR REPLACE TRIGGER "trg_search_index_events_pages" AFTER INSERT OR DELETE OR UPDATE ON "public"."events_pages" FOR EACH ROW EXECUTE FUNCTION "public"."trg_search_index_events_pages"();



CREATE OR REPLACE TRIGGER "trg_search_index_puzzle_pages" AFTER INSERT OR DELETE OR UPDATE ON "public"."puzzle_pages" FOR EACH ROW EXECUTE FUNCTION "public"."trg_search_index_puzzle_pages"();



CREATE OR REPLACE TRIGGER "trg_search_index_quiz_pages" AFTER INSERT OR DELETE OR UPDATE ON "public"."quiz_pages" FOR EACH ROW EXECUTE FUNCTION "public"."trg_search_index_quiz_pages"();



CREATE OR REPLACE TRIGGER "trg_search_index_tools" AFTER INSERT OR DELETE OR UPDATE ON "public"."tools" FOR EACH ROW EXECUTE FUNCTION "public"."trg_search_index_tools"();



CREATE OR REPLACE TRIGGER "trg_search_index_wiki_collection_pages" AFTER INSERT OR DELETE OR UPDATE ON "public"."wiki_collection_pages" FOR EACH ROW EXECUTE FUNCTION "public"."trg_search_index_wiki_collection_pages"();



CREATE OR REPLACE TRIGGER "trg_search_index_wiki_pages" AFTER INSERT OR DELETE OR UPDATE ON "public"."wiki_pages" FOR EACH ROW EXECUTE FUNCTION "public"."trg_search_index_wiki_pages"();



CREATE OR REPLACE TRIGGER "trg_set_article_published_at" BEFORE INSERT OR UPDATE ON "public"."articles" FOR EACH ROW EXECUTE FUNCTION "public"."set_article_published_at"();



CREATE OR REPLACE TRIGGER "trg_set_catalog_page_published_at" BEFORE INSERT OR UPDATE ON "public"."catalog_pages" FOR EACH ROW EXECUTE FUNCTION "public"."set_catalog_page_published_at"();



CREATE OR REPLACE TRIGGER "trg_set_checklist_published_at" BEFORE INSERT OR UPDATE ON "public"."checklist_pages" FOR EACH ROW EXECUTE FUNCTION "public"."set_checklist_published_at"();



CREATE OR REPLACE TRIGGER "trg_set_code_page_published_at" BEFORE INSERT OR UPDATE ON "public"."code_pages" FOR EACH ROW EXECUTE FUNCTION "public"."set_code_page_published_at"();



CREATE OR REPLACE TRIGGER "trg_set_events_pages_published_at" BEFORE INSERT OR UPDATE ON "public"."events_pages" FOR EACH ROW EXECUTE FUNCTION "public"."set_catalog_page_published_at"();



CREATE OR REPLACE TRIGGER "trg_set_puzzle_page_published_at" BEFORE INSERT OR UPDATE ON "public"."puzzle_pages" FOR EACH ROW EXECUTE FUNCTION "public"."set_puzzle_page_published_at"();



CREATE OR REPLACE TRIGGER "trg_set_quiz_page_published_at" BEFORE INSERT OR UPDATE ON "public"."quiz_pages" FOR EACH ROW EXECUTE FUNCTION "public"."set_quiz_page_published_at"();



CREATE OR REPLACE TRIGGER "trg_set_tool_published_at" BEFORE INSERT OR UPDATE ON "public"."tools" FOR EACH ROW EXECUTE FUNCTION "public"."set_tool_published_at"();



CREATE OR REPLACE TRIGGER "trg_set_wiki_collection_page_published_at" BEFORE INSERT OR UPDATE ON "public"."wiki_collection_pages" FOR EACH ROW EXECUTE FUNCTION "public"."set_catalog_page_published_at"();



CREATE OR REPLACE TRIGGER "trg_set_wiki_page_published_at" BEFORE INSERT OR UPDATE ON "public"."wiki_pages" FOR EACH ROW EXECUTE FUNCTION "public"."set_wiki_page_published_at"();



CREATE OR REPLACE TRIGGER "trg_tools_updated_at" BEFORE UPDATE ON "public"."tools" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "trg_user_checklist_progress_updated_at" BEFORE UPDATE ON "public"."user_checklist_progress" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "trg_user_code_progress_updated_at" BEFORE UPDATE ON "public"."user_code_progress" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "trg_user_quiz_progress_updated_at" BEFORE UPDATE ON "public"."user_quiz_progress" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "trg_wiki_collection_pages_updated_at" BEFORE UPDATE ON "public"."wiki_collection_pages" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "trg_wiki_pages_updated_at" BEFORE UPDATE ON "public"."wiki_pages" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



ALTER TABLE ONLY "public"."app_sessions"
    ADD CONSTRAINT "app_sessions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."app_users"("user_id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."article_generation_artifacts"
    ADD CONSTRAINT "article_generation_artifacts_article_id_fkey" FOREIGN KEY ("article_id") REFERENCES "public"."articles"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."article_generation_artifacts"
    ADD CONSTRAINT "article_generation_artifacts_queue_id_fkey" FOREIGN KEY ("queue_id") REFERENCES "public"."article_generation_queue"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."article_generation_artifacts"
    ADD CONSTRAINT "article_generation_artifacts_universe_id_fkey" FOREIGN KEY ("universe_id") REFERENCES "public"."roblox_universes"("universe_id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."article_generation_queue"
    ADD CONSTRAINT "article_generation_queue_article_id_fkey" FOREIGN KEY ("article_id") REFERENCES "public"."articles"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."article_generation_queue"
    ADD CONSTRAINT "article_generation_queue_universe_id_fkey" FOREIGN KEY ("universe_id") REFERENCES "public"."roblox_universes"("universe_id");



ALTER TABLE ONLY "public"."article_source_images"
    ADD CONSTRAINT "article_source_images_article_id_fkey" FOREIGN KEY ("article_id") REFERENCES "public"."articles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."articles"
    ADD CONSTRAINT "articles_author_id_fkey" FOREIGN KEY ("author_id") REFERENCES "public"."authors"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."articles"
    ADD CONSTRAINT "articles_universe_id_fkey" FOREIGN KEY ("universe_id") REFERENCES "public"."roblox_universes"("universe_id");



ALTER TABLE ONLY "public"."catalog_pages"
    ADD CONSTRAINT "catalog_pages_universe_id_fkey" FOREIGN KEY ("universe_id") REFERENCES "public"."roblox_universes"("universe_id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."checklist_items"
    ADD CONSTRAINT "checklist_items_page_id_fkey" FOREIGN KEY ("page_id") REFERENCES "public"."checklist_pages"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."checklist_pages"
    ADD CONSTRAINT "checklist_pages_universe_id_fkey" FOREIGN KEY ("universe_id") REFERENCES "public"."roblox_universes"("universe_id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."code_pages"
    ADD CONSTRAINT "code_pages_universe_id_fkey" FOREIGN KEY ("universe_id") REFERENCES "public"."roblox_universes"("universe_id");



ALTER TABLE ONLY "public"."codes"
    ADD CONSTRAINT "codes_code_page_id_fkey" FOREIGN KEY ("code_page_id") REFERENCES "public"."code_pages"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."comments"
    ADD CONSTRAINT "comments_author_id_fkey" FOREIGN KEY ("author_id") REFERENCES "public"."app_users"("user_id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."comments"
    ADD CONSTRAINT "comments_parent_id_fkey" FOREIGN KEY ("parent_id") REFERENCES "public"."comments"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."event_guide_generation_queue"
    ADD CONSTRAINT "event_guide_generation_queue_article_id_fkey" FOREIGN KEY ("article_id") REFERENCES "public"."articles"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."event_guide_generation_queue"
    ADD CONSTRAINT "event_guide_generation_queue_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "public"."roblox_virtual_events"("event_id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."event_guide_generation_queue"
    ADD CONSTRAINT "event_guide_generation_queue_universe_id_fkey" FOREIGN KEY ("universe_id") REFERENCES "public"."roblox_universes"("universe_id");



ALTER TABLE ONLY "public"."events_pages"
    ADD CONSTRAINT "events_pages_universe_id_fkey" FOREIGN KEY ("universe_id") REFERENCES "public"."roblox_universes"("universe_id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."puzzle_answers"
    ADD CONSTRAINT "puzzle_answers_puzzle_slug_fkey" FOREIGN KEY ("puzzle_slug") REFERENCES "public"."puzzle_pages"("slug") ON UPDATE CASCADE ON DELETE CASCADE;



ALTER TABLE ONLY "public"."quiz_pages"
    ADD CONSTRAINT "quiz_pages_universe_id_fkey" FOREIGN KEY ("universe_id") REFERENCES "public"."roblox_universes"("universe_id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."roblox_catalog_discovery_hits"
    ADD CONSTRAINT "roblox_catalog_discovery_hits_asset_id_fkey" FOREIGN KEY ("asset_id") REFERENCES "public"."roblox_catalog_items"("asset_id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."roblox_catalog_discovery_hits"
    ADD CONSTRAINT "roblox_catalog_discovery_hits_run_id_fkey" FOREIGN KEY ("run_id") REFERENCES "public"."roblox_catalog_discovery_runs"("run_id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."roblox_catalog_item_images"
    ADD CONSTRAINT "roblox_catalog_item_images_asset_id_fkey" FOREIGN KEY ("asset_id") REFERENCES "public"."roblox_catalog_items"("asset_id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."roblox_catalog_item_resale_points"
    ADD CONSTRAINT "roblox_catalog_item_resale_points_asset_id_fkey" FOREIGN KEY ("asset_id") REFERENCES "public"."roblox_catalog_items"("asset_id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."roblox_catalog_item_stats_daily"
    ADD CONSTRAINT "roblox_catalog_item_stats_daily_asset_id_fkey" FOREIGN KEY ("asset_id") REFERENCES "public"."roblox_catalog_items"("asset_id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."roblox_catalog_item_stats_hourly"
    ADD CONSTRAINT "roblox_catalog_item_stats_hourly_asset_id_fkey" FOREIGN KEY ("asset_id") REFERENCES "public"."roblox_catalog_items"("asset_id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."roblox_catalog_items_history"
    ADD CONSTRAINT "roblox_catalog_items_history_asset_id_fkey" FOREIGN KEY ("asset_id") REFERENCES "public"."roblox_catalog_items"("asset_id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."roblox_catalog_refresh_queue"
    ADD CONSTRAINT "roblox_catalog_refresh_queue_asset_id_fkey" FOREIGN KEY ("asset_id") REFERENCES "public"."roblox_catalog_items"("asset_id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."roblox_catalog_subcategories"
    ADD CONSTRAINT "roblox_catalog_subcategories_category_fkey" FOREIGN KEY ("category") REFERENCES "public"."roblox_catalog_categories"("category") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."roblox_decal_id_sources"
    ADD CONSTRAINT "roblox_decal_id_sources_asset_id_fkey" FOREIGN KEY ("asset_id") REFERENCES "public"."roblox_decal_ids"("asset_id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."roblox_universe_badges"
    ADD CONSTRAINT "roblox_universe_badges_universe_id_fkey" FOREIGN KEY ("universe_id") REFERENCES "public"."roblox_universes"("universe_id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."roblox_universe_gamepasses"
    ADD CONSTRAINT "roblox_universe_gamepasses_universe_id_fkey" FOREIGN KEY ("universe_id") REFERENCES "public"."roblox_universes"("universe_id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."roblox_universe_media"
    ADD CONSTRAINT "roblox_universe_media_universe_id_fkey" FOREIGN KEY ("universe_id") REFERENCES "public"."roblox_universes"("universe_id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."roblox_universe_place_servers"
    ADD CONSTRAINT "roblox_universe_place_servers_universe_id_fkey" FOREIGN KEY ("universe_id") REFERENCES "public"."roblox_universes"("universe_id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."roblox_universe_rank_snapshots_daily"
    ADD CONSTRAINT "roblox_universe_rank_snapshots_daily_universe_id_fkey" FOREIGN KEY ("universe_id") REFERENCES "public"."roblox_universes"("universe_id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."roblox_universe_rank_snapshots_hourly"
    ADD CONSTRAINT "roblox_universe_rank_snapshots_hourly_universe_id_fkey" FOREIGN KEY ("universe_id") REFERENCES "public"."roblox_universes"("universe_id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."roblox_universe_rank_snapshots"
    ADD CONSTRAINT "roblox_universe_rank_snapshots_universe_id_fkey" FOREIGN KEY ("universe_id") REFERENCES "public"."roblox_universes"("universe_id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."roblox_universe_social_links"
    ADD CONSTRAINT "roblox_universe_social_links_universe_id_fkey" FOREIGN KEY ("universe_id") REFERENCES "public"."roblox_universes"("universe_id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."roblox_universe_stats_daily"
    ADD CONSTRAINT "roblox_universe_stats_daily_universe_id_fkey" FOREIGN KEY ("universe_id") REFERENCES "public"."roblox_universes"("universe_id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."roblox_universe_stats_hourly"
    ADD CONSTRAINT "roblox_universe_stats_hourly_universe_id_fkey" FOREIGN KEY ("universe_id") REFERENCES "public"."roblox_universes"("universe_id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."roblox_universe_update_events"
    ADD CONSTRAINT "roblox_universe_update_events_universe_id_fkey" FOREIGN KEY ("universe_id") REFERENCES "public"."roblox_universes"("universe_id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."roblox_virtual_event_categories"
    ADD CONSTRAINT "roblox_virtual_event_categories_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "public"."roblox_virtual_events"("event_id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."roblox_virtual_event_thumbnails"
    ADD CONSTRAINT "roblox_virtual_event_thumbnails_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "public"."roblox_virtual_events"("event_id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."roblox_virtual_events"
    ADD CONSTRAINT "roblox_virtual_events_universe_id_fkey" FOREIGN KEY ("universe_id") REFERENCES "public"."roblox_universes"("universe_id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."stats_creator_current_index"
    ADD CONSTRAINT "stats_creator_current_index_top_universe_id_fkey" FOREIGN KEY ("top_universe_id") REFERENCES "public"."roblox_universes"("universe_id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."stats_game_current_index"
    ADD CONSTRAINT "stats_game_current_index_universe_id_fkey" FOREIGN KEY ("universe_id") REFERENCES "public"."roblox_universes"("universe_id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."stats_genre_current_index"
    ADD CONSTRAINT "stats_genre_current_index_top_universe_id_fkey" FOREIGN KEY ("top_universe_id") REFERENCES "public"."roblox_universes"("universe_id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."stats_item_current_index"
    ADD CONSTRAINT "stats_item_current_index_asset_id_fkey" FOREIGN KEY ("asset_id") REFERENCES "public"."roblox_catalog_items"("asset_id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."stats_item_price_movers_current_index"
    ADD CONSTRAINT "stats_item_price_movers_current_index_asset_id_fkey" FOREIGN KEY ("asset_id") REFERENCES "public"."roblox_catalog_items"("asset_id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."stats_risers_current_index"
    ADD CONSTRAINT "stats_risers_current_index_universe_id_fkey" FOREIGN KEY ("universe_id") REFERENCES "public"."roblox_universes"("universe_id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."tools"
    ADD CONSTRAINT "tools_universe_id_fkey" FOREIGN KEY ("universe_id") REFERENCES "public"."roblox_universes"("universe_id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."user_checklist_progress"
    ADD CONSTRAINT "user_checklist_progress_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."app_users"("user_id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."user_code_progress"
    ADD CONSTRAINT "user_code_progress_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."app_users"("user_id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."user_quiz_progress"
    ADD CONSTRAINT "user_quiz_progress_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."app_users"("user_id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."wiki_collection_pages"
    ADD CONSTRAINT "wiki_collection_pages_universe_id_fkey" FOREIGN KEY ("universe_id") REFERENCES "public"."roblox_universes"("universe_id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."wiki_collection_pages"
    ADD CONSTRAINT "wiki_collection_pages_wiki_page_id_fkey" FOREIGN KEY ("wiki_page_id") REFERENCES "public"."wiki_pages"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."wiki_pages"
    ADD CONSTRAINT "wiki_pages_universe_id_fkey" FOREIGN KEY ("universe_id") REFERENCES "public"."roblox_universes"("universe_id") ON DELETE SET NULL;



ALTER TABLE "public"."app_sessions" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."app_users" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "app_users_insert_self" ON "public"."app_users" FOR INSERT WITH CHECK ((("auth"."uid"() = "user_id") AND ("role" = 'user'::"text")));



CREATE POLICY "app_users_read_self" ON "public"."app_users" FOR SELECT USING (("auth"."uid"() = "user_id"));



CREATE POLICY "app_users_update_self" ON "public"."app_users" FOR UPDATE USING (("auth"."uid"() = "user_id")) WITH CHECK ((("auth"."uid"() = "user_id") AND ("role" = 'user'::"text")));



ALTER TABLE "public"."article_generation_artifacts" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."article_generation_queue" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."article_source_images" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."articles" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."authors" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "basebuddy_editor_insert" ON "public"."revalidation_events" FOR INSERT TO "basebuddy_editor" WITH CHECK (true);



CREATE POLICY "basebuddy_editor_insert" ON "public"."search_index" FOR INSERT TO "basebuddy_editor" WITH CHECK (true);



CREATE POLICY "basebuddy_editor_select" ON "public"."articles" FOR SELECT TO "basebuddy_editor" USING (true);



CREATE POLICY "basebuddy_editor_select" ON "public"."authors" FOR SELECT TO "basebuddy_editor" USING (true);



CREATE POLICY "basebuddy_editor_select" ON "public"."catalog_pages" FOR SELECT TO "basebuddy_editor" USING (true);



CREATE POLICY "basebuddy_editor_select" ON "public"."checklist_pages" FOR SELECT TO "basebuddy_editor" USING (true);



CREATE POLICY "basebuddy_editor_select" ON "public"."code_pages" FOR SELECT TO "basebuddy_editor" USING (true);



CREATE POLICY "basebuddy_editor_select" ON "public"."events_pages" FOR SELECT TO "basebuddy_editor" USING (true);



CREATE POLICY "basebuddy_editor_select" ON "public"."quiz_pages" FOR SELECT TO "basebuddy_editor" USING (true);



CREATE POLICY "basebuddy_editor_select" ON "public"."revalidation_events" FOR SELECT TO "basebuddy_editor" USING (true);



CREATE POLICY "basebuddy_editor_select" ON "public"."roblox_universes" FOR SELECT TO "basebuddy_editor" USING (true);



CREATE POLICY "basebuddy_editor_select" ON "public"."search_index" FOR SELECT TO "basebuddy_editor" USING (true);



CREATE POLICY "basebuddy_editor_select" ON "public"."tools" FOR SELECT TO "basebuddy_editor" USING (true);



CREATE POLICY "basebuddy_editor_select" ON "public"."wiki_collection_pages" FOR SELECT TO "basebuddy_editor" USING (true);



CREATE POLICY "basebuddy_editor_select" ON "public"."wiki_pages" FOR SELECT TO "basebuddy_editor" USING (true);



CREATE POLICY "basebuddy_editor_update" ON "public"."articles" FOR UPDATE TO "basebuddy_editor" USING (true) WITH CHECK (true);



CREATE POLICY "basebuddy_editor_update" ON "public"."catalog_pages" FOR UPDATE TO "basebuddy_editor" USING (true) WITH CHECK (true);



CREATE POLICY "basebuddy_editor_update" ON "public"."checklist_pages" FOR UPDATE TO "basebuddy_editor" USING (true) WITH CHECK (true);



CREATE POLICY "basebuddy_editor_update" ON "public"."code_pages" FOR UPDATE TO "basebuddy_editor" USING (true) WITH CHECK (true);



CREATE POLICY "basebuddy_editor_update" ON "public"."events_pages" FOR UPDATE TO "basebuddy_editor" USING (true) WITH CHECK (true);



CREATE POLICY "basebuddy_editor_update" ON "public"."quiz_pages" FOR UPDATE TO "basebuddy_editor" USING (true) WITH CHECK (true);



CREATE POLICY "basebuddy_editor_update" ON "public"."revalidation_events" FOR UPDATE TO "basebuddy_editor" USING (true) WITH CHECK (true);



CREATE POLICY "basebuddy_editor_update" ON "public"."search_index" FOR UPDATE TO "basebuddy_editor" USING (true) WITH CHECK (true);



CREATE POLICY "basebuddy_editor_update" ON "public"."tools" FOR UPDATE TO "basebuddy_editor" USING (true) WITH CHECK (true);



CREATE POLICY "basebuddy_editor_update" ON "public"."wiki_collection_pages" FOR UPDATE TO "basebuddy_editor" USING (true) WITH CHECK (true);



CREATE POLICY "basebuddy_editor_update" ON "public"."wiki_pages" FOR UPDATE TO "basebuddy_editor" USING (true) WITH CHECK (true);



ALTER TABLE "public"."cache_warm_events" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."cache_warm_worker_runs" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."catalog_pages" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."checklist_items" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."checklist_pages" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."code_pages" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."codes" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."comments" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "comments_insert_authenticated" ON "public"."comments" FOR INSERT WITH CHECK ((("auth"."uid"() = "author_id") AND ("status" = 'pending'::"text") AND ("moderation" IS NULL)));



CREATE POLICY "comments_insert_guest" ON "public"."comments" FOR INSERT WITH CHECK ((("auth"."uid"() IS NULL) AND ("author_id" IS NULL) AND ("guest_name" IS NOT NULL) AND ("length"(TRIM(BOTH FROM "guest_name")) >= 2) AND ("guest_email" IS NOT NULL) AND (POSITION(('@'::"text") IN ("guest_email")) > 1) AND ("status" = 'pending'::"text") AND ("moderation" IS NULL)));



CREATE POLICY "comments_select_public" ON "public"."comments" FOR SELECT USING ((("status" = 'approved'::"text") OR ("author_id" = "auth"."uid"())));



ALTER TABLE "public"."event_guide_generation_queue" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."events_pages" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."game_generation_queue" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."google_indexing_attempts" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."google_indexing_url_state" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."puzzle_answers" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "puzzle_answers_admin_full_access" ON "public"."puzzle_answers" USING ("public"."is_admin"("auth"."uid"())) WITH CHECK ("public"."is_admin"("auth"."uid"()));



CREATE POLICY "puzzle_answers_public_read" ON "public"."puzzle_answers" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."puzzle_pages" "pp"
  WHERE (("pp"."slug" = "puzzle_answers"."puzzle_slug") AND ("pp"."is_published" = true)))));



ALTER TABLE "public"."puzzle_pages" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "puzzle_pages_admin_full_access" ON "public"."puzzle_pages" USING ("public"."is_admin"("auth"."uid"())) WITH CHECK ("public"."is_admin"("auth"."uid"()));



CREATE POLICY "puzzle_pages_public_read" ON "public"."puzzle_pages" FOR SELECT USING (("is_published" = true));



ALTER TABLE "public"."puzzle_sync_runs" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "puzzle_sync_runs_admin_full_access" ON "public"."puzzle_sync_runs" USING ("public"."is_admin"("auth"."uid"())) WITH CHECK ("public"."is_admin"("auth"."uid"()));



ALTER TABLE "public"."quiz_pages" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "quiz_pages_admin_full_access" ON "public"."quiz_pages" TO "authenticated" USING ("public"."is_admin"("auth"."uid"())) WITH CHECK ("public"."is_admin"("auth"."uid"()));



CREATE POLICY "quiz_pages_public_read" ON "public"."quiz_pages" FOR SELECT TO "authenticated", "anon" USING (("is_published" = true));



ALTER TABLE "public"."revalidation_events" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."revalidation_worker_runs" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."roblox_catalog_categories" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."roblox_catalog_discovery_hits" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."roblox_catalog_discovery_runs" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."roblox_catalog_item_images" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."roblox_catalog_item_resale_points" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."roblox_catalog_item_stats_daily" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."roblox_catalog_item_stats_hourly" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."roblox_catalog_items" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."roblox_catalog_items_history" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."roblox_catalog_refresh_queue" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."roblox_catalog_subcategories" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."roblox_decal_id_sources" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "roblox_decal_id_sources_admin_full_access" ON "public"."roblox_decal_id_sources" TO "authenticated" USING ("public"."is_admin"("auth"."uid"())) WITH CHECK ("public"."is_admin"("auth"."uid"()));



ALTER TABLE "public"."roblox_decal_ids" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "roblox_decal_ids_admin_full_access" ON "public"."roblox_decal_ids" TO "authenticated" USING ("public"."is_admin"("auth"."uid"())) WITH CHECK ("public"."is_admin"("auth"."uid"()));



CREATE POLICY "roblox_decal_ids_public_read" ON "public"."roblox_decal_ids" FOR SELECT TO "authenticated", "anon" USING (("status" = 'active'::"text"));



ALTER TABLE "public"."roblox_groups" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."roblox_music_ids" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."roblox_promo_rewards" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."roblox_universe_badges" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."roblox_universe_gamepasses" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."roblox_universe_media" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."roblox_universe_place_servers" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."roblox_universe_rank_snapshots" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."roblox_universe_rank_snapshots_daily" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "roblox_universe_rank_snapshots_daily_select" ON "public"."roblox_universe_rank_snapshots_daily" FOR SELECT USING (true);



ALTER TABLE "public"."roblox_universe_rank_snapshots_hourly" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "roblox_universe_rank_snapshots_hourly_select" ON "public"."roblox_universe_rank_snapshots_hourly" FOR SELECT USING (true);



CREATE POLICY "roblox_universe_rank_snapshots_select" ON "public"."roblox_universe_rank_snapshots" FOR SELECT USING (true);



ALTER TABLE "public"."roblox_universe_social_links" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."roblox_universe_stats_daily" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."roblox_universe_stats_hourly" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "roblox_universe_stats_hourly_select" ON "public"."roblox_universe_stats_hourly" FOR SELECT USING (true);



ALTER TABLE "public"."roblox_universe_update_events" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "roblox_universe_update_events_select" ON "public"."roblox_universe_update_events" FOR SELECT USING (true);



ALTER TABLE "public"."roblox_universes" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."roblox_virtual_event_categories" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."roblox_virtual_event_thumbnails" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."roblox_virtual_events" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."search_index" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."site_feedback" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."stats_creator_current_index" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."stats_game_current_index" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."stats_genre_current_index" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."stats_item_current_index" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."stats_item_price_movers_current_index" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."stats_job_runs" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."stats_risers_current_index" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."tools" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."user_checklist_progress" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "user_checklist_progress_delete_own" ON "public"."user_checklist_progress" FOR DELETE USING (("auth"."uid"() = "user_id"));



CREATE POLICY "user_checklist_progress_insert_own" ON "public"."user_checklist_progress" FOR INSERT WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "user_checklist_progress_select_own" ON "public"."user_checklist_progress" FOR SELECT USING (("auth"."uid"() = "user_id"));



CREATE POLICY "user_checklist_progress_update_own" ON "public"."user_checklist_progress" FOR UPDATE USING (("auth"."uid"() = "user_id")) WITH CHECK (("auth"."uid"() = "user_id"));



ALTER TABLE "public"."user_code_progress" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "user_code_progress_delete_own" ON "public"."user_code_progress" FOR DELETE USING (("auth"."uid"() = "user_id"));



CREATE POLICY "user_code_progress_insert_own" ON "public"."user_code_progress" FOR INSERT WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "user_code_progress_select_own" ON "public"."user_code_progress" FOR SELECT USING (("auth"."uid"() = "user_id"));



CREATE POLICY "user_code_progress_update_own" ON "public"."user_code_progress" FOR UPDATE USING (("auth"."uid"() = "user_id")) WITH CHECK (("auth"."uid"() = "user_id"));



ALTER TABLE "public"."user_quiz_progress" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "user_quiz_progress_delete_own" ON "public"."user_quiz_progress" FOR DELETE USING (("auth"."uid"() = "user_id"));



CREATE POLICY "user_quiz_progress_insert_own" ON "public"."user_quiz_progress" FOR INSERT WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "user_quiz_progress_select_own" ON "public"."user_quiz_progress" FOR SELECT USING (("auth"."uid"() = "user_id"));



CREATE POLICY "user_quiz_progress_update_own" ON "public"."user_quiz_progress" FOR UPDATE USING (("auth"."uid"() = "user_id")) WITH CHECK (("auth"."uid"() = "user_id"));



ALTER TABLE "public"."wiki_collection_pages" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."wiki_pages" ENABLE ROW LEVEL SECURITY;


GRANT USAGE ON SCHEMA "extensions" TO "anon";
GRANT USAGE ON SCHEMA "extensions" TO "authenticated";
GRANT USAGE ON SCHEMA "extensions" TO "service_role";
GRANT ALL ON SCHEMA "extensions" TO "dashboard_user";



REVOKE USAGE ON SCHEMA "public" FROM PUBLIC;
GRANT USAGE ON SCHEMA "public" TO "postgres";
GRANT USAGE ON SCHEMA "public" TO "anon";
GRANT USAGE ON SCHEMA "public" TO "authenticated";
GRANT USAGE ON SCHEMA "public" TO "service_role";
GRANT USAGE ON SCHEMA "public" TO "basebuddy_editor";



REVOKE ALL ON FUNCTION "extensions"."grant_pg_cron_access"() FROM "supabase_admin";
GRANT ALL ON FUNCTION "extensions"."grant_pg_cron_access"() TO "supabase_admin" WITH GRANT OPTION;
GRANT ALL ON FUNCTION "extensions"."grant_pg_cron_access"() TO "dashboard_user";



GRANT ALL ON FUNCTION "extensions"."grant_pg_graphql_access"() TO "postgres" WITH GRANT OPTION;



REVOKE ALL ON FUNCTION "extensions"."grant_pg_net_access"() FROM "supabase_admin";
GRANT ALL ON FUNCTION "extensions"."grant_pg_net_access"() TO "supabase_admin" WITH GRANT OPTION;
GRANT ALL ON FUNCTION "extensions"."grant_pg_net_access"() TO "dashboard_user";



GRANT ALL ON FUNCTION "extensions"."pgrst_ddl_watch"() TO "postgres" WITH GRANT OPTION;



GRANT ALL ON FUNCTION "extensions"."pgrst_drop_watch"() TO "postgres" WITH GRANT OPTION;



GRANT ALL ON FUNCTION "extensions"."set_graphql_placeholder"() TO "postgres" WITH GRANT OPTION;



GRANT ALL ON FUNCTION "public"."article_generation_queue_idempotency_key"("title" "text", "universe_id" bigint) TO "anon";
GRANT ALL ON FUNCTION "public"."article_generation_queue_idempotency_key"("title" "text", "universe_id" bigint) TO "authenticated";
GRANT ALL ON FUNCTION "public"."article_generation_queue_idempotency_key"("title" "text", "universe_id" bigint) TO "service_role";



GRANT ALL ON FUNCTION "public"."avatar_catalog_slugs_for_catalog_item"("p_category" "text", "p_subcategory" "text", "p_asset_type_id" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."avatar_catalog_slugs_for_catalog_item"("p_category" "text", "p_subcategory" "text", "p_asset_type_id" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."avatar_catalog_slugs_for_catalog_item"("p_category" "text", "p_subcategory" "text", "p_asset_type_id" integer) TO "service_role";



REVOKE ALL ON FUNCTION "public"."calculate_roblox_rating_percent"("p_likes" bigint, "p_dislikes" bigint) FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."calculate_roblox_rating_percent"("p_likes" bigint, "p_dislikes" bigint) TO "service_role";



GRANT ALL ON TABLE "public"."article_generation_queue" TO "anon";
GRANT ALL ON TABLE "public"."article_generation_queue" TO "authenticated";
GRANT ALL ON TABLE "public"."article_generation_queue" TO "service_role";



REVOKE ALL ON FUNCTION "public"."claim_article_generation_queue_item"("p_queue_id" "uuid", "p_worker_id" "text", "p_max_attempts" integer) FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."claim_article_generation_queue_item"("p_queue_id" "uuid", "p_worker_id" "text", "p_max_attempts" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."claim_article_generation_queue_item"("p_queue_id" "uuid", "p_worker_id" "text", "p_max_attempts" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."claim_article_generation_queue_item"("p_queue_id" "uuid", "p_worker_id" "text", "p_max_attempts" integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."enqueue_author_revalidation_for_author_id"("p_author_id" "uuid", "p_source" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."enqueue_author_revalidation_for_author_id"("p_author_id" "uuid", "p_source" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."enqueue_author_revalidation_for_author_id"("p_author_id" "uuid", "p_source" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."enqueue_free_items_catalog_scope"("p_category" "text", "p_subcategory" "text", "p_source" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."enqueue_free_items_catalog_scope"("p_category" "text", "p_subcategory" "text", "p_source" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."enqueue_free_items_catalog_scope"("p_category" "text", "p_subcategory" "text", "p_source" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."enqueue_music_revalidation_scope"("p_section" "text", "p_value" "text", "p_source" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."enqueue_music_revalidation_scope"("p_section" "text", "p_value" "text", "p_source" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."enqueue_music_revalidation_scope"("p_section" "text", "p_value" "text", "p_source" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."enqueue_revalidation"("p_entity_type" "text", "p_slug" "text", "p_source" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."enqueue_revalidation"("p_entity_type" "text", "p_slug" "text", "p_source" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."enqueue_revalidation"("p_entity_type" "text", "p_slug" "text", "p_source" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."enqueue_wiki_revalidation_for_universe"("p_universe_id" bigint, "p_source" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."enqueue_wiki_revalidation_for_universe"("p_universe_id" bigint, "p_source" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."enqueue_wiki_revalidation_for_universe"("p_universe_id" bigint, "p_source" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."get_items_needing_metrics_calculation"("p_limit" integer, "p_max_age_hours" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."get_items_needing_metrics_calculation"("p_limit" integer, "p_max_age_hours" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_items_needing_metrics_calculation"("p_limit" integer, "p_max_age_hours" integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."get_items_needing_rap_update"("p_limit" integer, "p_max_age_hours" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."get_items_needing_rap_update"("p_limit" integer, "p_max_age_hours" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_items_needing_rap_update"("p_limit" integer, "p_max_age_hours" integer) TO "service_role";



REVOKE ALL ON FUNCTION "public"."get_stats_platform_ccu_trend"("p_since" timestamp with time zone) FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."get_stats_platform_ccu_trend"("p_since" timestamp with time zone) TO "postgres";
GRANT ALL ON FUNCTION "public"."get_stats_platform_ccu_trend"("p_since" timestamp with time zone) TO "service_role";



REVOKE ALL ON FUNCTION "public"."get_stats_platform_current_summary"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."get_stats_platform_current_summary"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."get_stats_subgenre_options"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."get_stats_subgenre_options"() TO "postgres";
GRANT ALL ON FUNCTION "public"."get_stats_subgenre_options"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."get_stats_visit_share_chart"("p_since" "date", "p_until" "date", "p_top_games" integer, "p_top_group" integer, "p_wide_group" integer) FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."get_stats_visit_share_chart"("p_since" "date", "p_until" "date", "p_top_games" integer, "p_top_group" integer, "p_wide_group" integer) TO "postgres";
GRANT ALL ON FUNCTION "public"."get_stats_visit_share_chart"("p_since" "date", "p_until" "date", "p_top_games" integer, "p_top_group" integer, "p_wide_group" integer) TO "service_role";



REVOKE ALL ON FUNCTION "public"."invoke_cache_warm_worker"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."invoke_cache_warm_worker"() TO "anon";
GRANT ALL ON FUNCTION "public"."invoke_cache_warm_worker"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."invoke_cache_warm_worker"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."invoke_revalidation_worker"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."invoke_revalidation_worker"() TO "anon";
GRANT ALL ON FUNCTION "public"."invoke_revalidation_worker"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."invoke_revalidation_worker"() TO "service_role";



GRANT ALL ON FUNCTION "public"."is_admin"("user_uuid" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."is_admin"("user_uuid" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."is_admin"("user_uuid" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."normalize_section_code"("raw" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."normalize_section_code"("raw" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."normalize_section_code"("raw" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."percent_delta"("p_current" numeric, "p_previous" numeric) TO "anon";
GRANT ALL ON FUNCTION "public"."percent_delta"("p_current" numeric, "p_previous" numeric) TO "authenticated";
GRANT ALL ON FUNCTION "public"."percent_delta"("p_current" numeric, "p_previous" numeric) TO "service_role";



REVOKE ALL ON FUNCTION "public"."prune_roblox_universe_hourly_history"("p_cutoff" timestamp with time zone, "p_batch_size" integer) FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."prune_roblox_universe_hourly_history"("p_cutoff" timestamp with time zone, "p_batch_size" integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."qualifies_for_free_items_catalog"("p_price_robux" bigint, "p_is_deleted" boolean, "p_is_for_sale" boolean, "p_has_resellers" boolean, "p_lowest_resale_price_robux" bigint, "p_name" "text", "p_category" "text", "p_subcategory" "text", "p_favorite_count" bigint, "p_free_claimability" "text", "p_free_verified_at" timestamp with time zone, "p_free_verification_source" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."qualifies_for_free_items_catalog"("p_price_robux" bigint, "p_is_deleted" boolean, "p_is_for_sale" boolean, "p_has_resellers" boolean, "p_lowest_resale_price_robux" bigint, "p_name" "text", "p_category" "text", "p_subcategory" "text", "p_favorite_count" bigint, "p_free_claimability" "text", "p_free_verified_at" timestamp with time zone, "p_free_verification_source" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."qualifies_for_free_items_catalog"("p_price_robux" bigint, "p_is_deleted" boolean, "p_is_for_sale" boolean, "p_has_resellers" boolean, "p_lowest_resale_price_robux" bigint, "p_name" "text", "p_category" "text", "p_subcategory" "text", "p_favorite_count" bigint, "p_free_claimability" "text", "p_free_verified_at" timestamp with time zone, "p_free_verification_source" "text") TO "service_role";



REVOKE ALL ON FUNCTION "public"."record_stats_health_check"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."record_stats_health_check"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."refresh_roblox_promo_rewards"("p_seen_rows" "jsonb", "p_checked_at" timestamp with time zone, "p_retire_after_misses" integer, "p_touch_catalog" boolean) FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."refresh_roblox_promo_rewards"("p_seen_rows" "jsonb", "p_checked_at" timestamp with time zone, "p_retire_after_misses" integer, "p_touch_catalog" boolean) TO "service_role";



GRANT ALL ON FUNCTION "public"."refresh_search_index_music"() TO "anon";
GRANT ALL ON FUNCTION "public"."refresh_search_index_music"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."refresh_search_index_music"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."refresh_stats_creator_current_index"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."refresh_stats_creator_current_index"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."refresh_stats_current_indexes"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."refresh_stats_current_indexes"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."refresh_stats_item_current_indexes"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."refresh_stats_item_current_indexes"() TO "postgres";
GRANT ALL ON FUNCTION "public"."refresh_stats_item_current_indexes"() TO "service_role";



GRANT ALL ON FUNCTION "public"."revalidation_slugify"("p_value" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."revalidation_slugify"("p_value" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."revalidation_slugify"("p_value" "text") TO "service_role";



REVOKE ALL ON FUNCTION "public"."rollup_roblox_universe_stats_daily"("p_stat_date" "date", "p_finalize" boolean, "p_universe_ids" bigint[]) FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."rollup_roblox_universe_stats_daily"("p_stat_date" "date", "p_finalize" boolean, "p_universe_ids" bigint[]) TO "service_role";



REVOKE ALL ON FUNCTION "public"."run_roblox_universe_hourly_prune"("p_days" integer, "p_batch_size" integer, "p_max_batches" integer) FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."run_roblox_universe_hourly_prune"("p_days" integer, "p_batch_size" integer, "p_max_batches" integer) TO "service_role";



REVOKE ALL ON FUNCTION "public"."sanitize_stats_creator_top_player"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."sanitize_stats_creator_top_player"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."sanitize_stats_game_current_player"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."sanitize_stats_game_current_player"() TO "service_role";



GRANT ALL ON FUNCTION "public"."search_site"("p_query" "text", "p_limit" integer, "p_offset" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."search_site"("p_query" "text", "p_limit" integer, "p_offset" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."search_site"("p_query" "text", "p_limit" integer, "p_offset" integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."set_article_generation_queue_idempotency_key"() TO "anon";
GRANT ALL ON FUNCTION "public"."set_article_generation_queue_idempotency_key"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."set_article_generation_queue_idempotency_key"() TO "service_role";



GRANT ALL ON FUNCTION "public"."set_article_published_at"() TO "anon";
GRANT ALL ON FUNCTION "public"."set_article_published_at"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."set_article_published_at"() TO "service_role";



GRANT ALL ON FUNCTION "public"."set_catalog_page_published_at"() TO "anon";
GRANT ALL ON FUNCTION "public"."set_catalog_page_published_at"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."set_catalog_page_published_at"() TO "service_role";



GRANT ALL ON FUNCTION "public"."set_checklist_published_at"() TO "anon";
GRANT ALL ON FUNCTION "public"."set_checklist_published_at"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."set_checklist_published_at"() TO "service_role";



GRANT ALL ON FUNCTION "public"."set_code_page_published_at"() TO "anon";
GRANT ALL ON FUNCTION "public"."set_code_page_published_at"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."set_code_page_published_at"() TO "service_role";



GRANT ALL ON FUNCTION "public"."set_google_indexing_url_state_updated_at"() TO "anon";
GRANT ALL ON FUNCTION "public"."set_google_indexing_url_state_updated_at"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."set_google_indexing_url_state_updated_at"() TO "service_role";



GRANT ALL ON FUNCTION "public"."set_puzzle_page_published_at"() TO "anon";
GRANT ALL ON FUNCTION "public"."set_puzzle_page_published_at"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."set_puzzle_page_published_at"() TO "service_role";



GRANT ALL ON FUNCTION "public"."set_quiz_page_published_at"() TO "anon";
GRANT ALL ON FUNCTION "public"."set_quiz_page_published_at"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."set_quiz_page_published_at"() TO "service_role";



GRANT ALL ON FUNCTION "public"."set_tool_published_at"() TO "anon";
GRANT ALL ON FUNCTION "public"."set_tool_published_at"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."set_tool_published_at"() TO "service_role";



GRANT ALL ON FUNCTION "public"."set_updated_at"() TO "anon";
GRANT ALL ON FUNCTION "public"."set_updated_at"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."set_updated_at"() TO "service_role";



GRANT ALL ON FUNCTION "public"."set_wiki_page_published_at"() TO "anon";
GRANT ALL ON FUNCTION "public"."set_wiki_page_published_at"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."set_wiki_page_published_at"() TO "service_role";



GRANT ALL ON FUNCTION "public"."slugify_stats_label"("p_value" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."slugify_stats_label"("p_value" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."slugify_stats_label"("p_value" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."stats_item_percent_delta"("p_current" numeric, "p_previous" numeric) TO "postgres";
GRANT ALL ON FUNCTION "public"."stats_item_percent_delta"("p_current" numeric, "p_previous" numeric) TO "anon";
GRANT ALL ON FUNCTION "public"."stats_item_percent_delta"("p_current" numeric, "p_previous" numeric) TO "authenticated";
GRANT ALL ON FUNCTION "public"."stats_item_percent_delta"("p_current" numeric, "p_previous" numeric) TO "service_role";



GRANT ALL ON FUNCTION "public"."stats_item_roblox_url"("p_asset_id" bigint, "p_item_type" "text", "p_raw_catalog_json" "jsonb") TO "postgres";
GRANT ALL ON FUNCTION "public"."stats_item_roblox_url"("p_asset_id" bigint, "p_item_type" "text", "p_raw_catalog_json" "jsonb") TO "anon";
GRANT ALL ON FUNCTION "public"."stats_item_roblox_url"("p_asset_id" bigint, "p_item_type" "text", "p_raw_catalog_json" "jsonb") TO "authenticated";
GRANT ALL ON FUNCTION "public"."stats_item_roblox_url"("p_asset_id" bigint, "p_item_type" "text", "p_raw_catalog_json" "jsonb") TO "service_role";



REVOKE ALL ON FUNCTION "public"."trg_canonicalize_article_media"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."trg_canonicalize_article_media"() TO "anon";
GRANT ALL ON FUNCTION "public"."trg_canonicalize_article_media"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."trg_canonicalize_article_media"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."trg_canonicalize_article_source_media"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."trg_canonicalize_article_source_media"() TO "anon";
GRANT ALL ON FUNCTION "public"."trg_canonicalize_article_source_media"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."trg_canonicalize_article_source_media"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."trg_canonicalize_code_page_media"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."trg_canonicalize_code_page_media"() TO "anon";
GRANT ALL ON FUNCTION "public"."trg_canonicalize_code_page_media"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."trg_canonicalize_code_page_media"() TO "service_role";



GRANT ALL ON FUNCTION "public"."trg_comments_revalidate_code"() TO "anon";
GRANT ALL ON FUNCTION "public"."trg_comments_revalidate_code"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."trg_comments_revalidate_code"() TO "service_role";



GRANT ALL ON FUNCTION "public"."trg_comments_revalidate_entity"() TO "anon";
GRANT ALL ON FUNCTION "public"."trg_comments_revalidate_entity"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."trg_comments_revalidate_entity"() TO "service_role";



GRANT ALL ON FUNCTION "public"."trg_enqueue_revalidation_articles"() TO "anon";
GRANT ALL ON FUNCTION "public"."trg_enqueue_revalidation_articles"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."trg_enqueue_revalidation_articles"() TO "service_role";



GRANT ALL ON FUNCTION "public"."trg_enqueue_revalidation_authors"() TO "anon";
GRANT ALL ON FUNCTION "public"."trg_enqueue_revalidation_authors"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."trg_enqueue_revalidation_authors"() TO "service_role";



GRANT ALL ON FUNCTION "public"."trg_enqueue_revalidation_avatar_catalog_images"() TO "anon";
GRANT ALL ON FUNCTION "public"."trg_enqueue_revalidation_avatar_catalog_images"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."trg_enqueue_revalidation_avatar_catalog_images"() TO "service_role";



GRANT ALL ON FUNCTION "public"."trg_enqueue_revalidation_avatar_catalog_items"() TO "anon";
GRANT ALL ON FUNCTION "public"."trg_enqueue_revalidation_avatar_catalog_items"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."trg_enqueue_revalidation_avatar_catalog_items"() TO "service_role";



GRANT ALL ON FUNCTION "public"."trg_enqueue_revalidation_catalog_pages"() TO "anon";
GRANT ALL ON FUNCTION "public"."trg_enqueue_revalidation_catalog_pages"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."trg_enqueue_revalidation_catalog_pages"() TO "service_role";



GRANT ALL ON FUNCTION "public"."trg_enqueue_revalidation_checklist_items"() TO "anon";
GRANT ALL ON FUNCTION "public"."trg_enqueue_revalidation_checklist_items"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."trg_enqueue_revalidation_checklist_items"() TO "service_role";



GRANT ALL ON FUNCTION "public"."trg_enqueue_revalidation_checklist_pages"() TO "anon";
GRANT ALL ON FUNCTION "public"."trg_enqueue_revalidation_checklist_pages"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."trg_enqueue_revalidation_checklist_pages"() TO "service_role";



GRANT ALL ON FUNCTION "public"."trg_enqueue_revalidation_code_pages"() TO "anon";
GRANT ALL ON FUNCTION "public"."trg_enqueue_revalidation_code_pages"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."trg_enqueue_revalidation_code_pages"() TO "service_role";



GRANT ALL ON FUNCTION "public"."trg_enqueue_revalidation_codes"() TO "anon";
GRANT ALL ON FUNCTION "public"."trg_enqueue_revalidation_codes"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."trg_enqueue_revalidation_codes"() TO "service_role";



GRANT ALL ON FUNCTION "public"."trg_enqueue_revalidation_decal_ids"() TO "postgres";
GRANT ALL ON FUNCTION "public"."trg_enqueue_revalidation_decal_ids"() TO "anon";
GRANT ALL ON FUNCTION "public"."trg_enqueue_revalidation_decal_ids"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."trg_enqueue_revalidation_decal_ids"() TO "service_role";



GRANT ALL ON FUNCTION "public"."trg_enqueue_revalidation_events_pages"() TO "anon";
GRANT ALL ON FUNCTION "public"."trg_enqueue_revalidation_events_pages"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."trg_enqueue_revalidation_events_pages"() TO "service_role";



GRANT ALL ON FUNCTION "public"."trg_enqueue_revalidation_free_item_images"() TO "anon";
GRANT ALL ON FUNCTION "public"."trg_enqueue_revalidation_free_item_images"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."trg_enqueue_revalidation_free_item_images"() TO "service_role";



GRANT ALL ON FUNCTION "public"."trg_enqueue_revalidation_free_items_catalog"() TO "anon";
GRANT ALL ON FUNCTION "public"."trg_enqueue_revalidation_free_items_catalog"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."trg_enqueue_revalidation_free_items_catalog"() TO "service_role";



GRANT ALL ON FUNCTION "public"."trg_enqueue_revalidation_music_ids"() TO "anon";
GRANT ALL ON FUNCTION "public"."trg_enqueue_revalidation_music_ids"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."trg_enqueue_revalidation_music_ids"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."trg_enqueue_revalidation_promo_rewards"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."trg_enqueue_revalidation_promo_rewards"() TO "service_role";



GRANT ALL ON FUNCTION "public"."trg_enqueue_revalidation_puzzle_answers"() TO "anon";
GRANT ALL ON FUNCTION "public"."trg_enqueue_revalidation_puzzle_answers"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."trg_enqueue_revalidation_puzzle_answers"() TO "service_role";



GRANT ALL ON FUNCTION "public"."trg_enqueue_revalidation_puzzle_pages"() TO "anon";
GRANT ALL ON FUNCTION "public"."trg_enqueue_revalidation_puzzle_pages"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."trg_enqueue_revalidation_puzzle_pages"() TO "service_role";



GRANT ALL ON FUNCTION "public"."trg_enqueue_revalidation_quiz_pages"() TO "anon";
GRANT ALL ON FUNCTION "public"."trg_enqueue_revalidation_quiz_pages"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."trg_enqueue_revalidation_quiz_pages"() TO "service_role";



GRANT ALL ON FUNCTION "public"."trg_enqueue_revalidation_stats_items"() TO "postgres";
GRANT ALL ON FUNCTION "public"."trg_enqueue_revalidation_stats_items"() TO "anon";
GRANT ALL ON FUNCTION "public"."trg_enqueue_revalidation_stats_items"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."trg_enqueue_revalidation_stats_items"() TO "service_role";



GRANT ALL ON FUNCTION "public"."trg_enqueue_revalidation_tools"() TO "anon";
GRANT ALL ON FUNCTION "public"."trg_enqueue_revalidation_tools"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."trg_enqueue_revalidation_tools"() TO "service_role";



GRANT ALL ON FUNCTION "public"."trg_enqueue_revalidation_virtual_event_assets"() TO "anon";
GRANT ALL ON FUNCTION "public"."trg_enqueue_revalidation_virtual_event_assets"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."trg_enqueue_revalidation_virtual_event_assets"() TO "service_role";



GRANT ALL ON FUNCTION "public"."trg_enqueue_revalidation_virtual_events"() TO "anon";
GRANT ALL ON FUNCTION "public"."trg_enqueue_revalidation_virtual_events"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."trg_enqueue_revalidation_virtual_events"() TO "service_role";



GRANT ALL ON FUNCTION "public"."trg_enqueue_revalidation_wiki_collection_pages"() TO "anon";
GRANT ALL ON FUNCTION "public"."trg_enqueue_revalidation_wiki_collection_pages"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."trg_enqueue_revalidation_wiki_collection_pages"() TO "service_role";



GRANT ALL ON FUNCTION "public"."trg_enqueue_revalidation_wiki_pages"() TO "anon";
GRANT ALL ON FUNCTION "public"."trg_enqueue_revalidation_wiki_pages"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."trg_enqueue_revalidation_wiki_pages"() TO "service_role";



GRANT ALL ON FUNCTION "public"."trg_enqueue_revalidation_wiki_universe"() TO "anon";
GRANT ALL ON FUNCTION "public"."trg_enqueue_revalidation_wiki_universe"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."trg_enqueue_revalidation_wiki_universe"() TO "service_role";



GRANT ALL ON FUNCTION "public"."trg_normalize_section_code"() TO "anon";
GRANT ALL ON FUNCTION "public"."trg_normalize_section_code"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."trg_normalize_section_code"() TO "service_role";



GRANT ALL ON FUNCTION "public"."trg_refresh_search_index_music"() TO "anon";
GRANT ALL ON FUNCTION "public"."trg_refresh_search_index_music"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."trg_refresh_search_index_music"() TO "service_role";



GRANT ALL ON FUNCTION "public"."trg_search_index_articles"() TO "anon";
GRANT ALL ON FUNCTION "public"."trg_search_index_articles"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."trg_search_index_articles"() TO "service_role";



GRANT ALL ON FUNCTION "public"."trg_search_index_authors"() TO "anon";
GRANT ALL ON FUNCTION "public"."trg_search_index_authors"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."trg_search_index_authors"() TO "service_role";



GRANT ALL ON FUNCTION "public"."trg_search_index_catalog_pages"() TO "anon";
GRANT ALL ON FUNCTION "public"."trg_search_index_catalog_pages"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."trg_search_index_catalog_pages"() TO "service_role";



GRANT ALL ON FUNCTION "public"."trg_search_index_checklists"() TO "anon";
GRANT ALL ON FUNCTION "public"."trg_search_index_checklists"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."trg_search_index_checklists"() TO "service_role";



GRANT ALL ON FUNCTION "public"."trg_search_index_code_pages"() TO "anon";
GRANT ALL ON FUNCTION "public"."trg_search_index_code_pages"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."trg_search_index_code_pages"() TO "service_role";



GRANT ALL ON FUNCTION "public"."trg_search_index_events_pages"() TO "anon";
GRANT ALL ON FUNCTION "public"."trg_search_index_events_pages"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."trg_search_index_events_pages"() TO "service_role";



GRANT ALL ON FUNCTION "public"."trg_search_index_puzzle_pages"() TO "anon";
GRANT ALL ON FUNCTION "public"."trg_search_index_puzzle_pages"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."trg_search_index_puzzle_pages"() TO "service_role";



GRANT ALL ON FUNCTION "public"."trg_search_index_quiz_pages"() TO "anon";
GRANT ALL ON FUNCTION "public"."trg_search_index_quiz_pages"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."trg_search_index_quiz_pages"() TO "service_role";



GRANT ALL ON FUNCTION "public"."trg_search_index_tools"() TO "anon";
GRANT ALL ON FUNCTION "public"."trg_search_index_tools"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."trg_search_index_tools"() TO "service_role";



GRANT ALL ON FUNCTION "public"."trg_search_index_wiki_collection_pages"() TO "anon";
GRANT ALL ON FUNCTION "public"."trg_search_index_wiki_collection_pages"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."trg_search_index_wiki_collection_pages"() TO "service_role";



GRANT ALL ON FUNCTION "public"."trg_search_index_wiki_pages"() TO "anon";
GRANT ALL ON FUNCTION "public"."trg_search_index_wiki_pages"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."trg_search_index_wiki_pages"() TO "service_role";



GRANT ALL ON FUNCTION "public"."upsert_code"("p_code_page_id" "uuid", "p_code" "text", "p_status" "text", "p_rewards_text" "text", "p_level_requirement" integer, "p_is_new" boolean, "p_provider_priority" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."upsert_code"("p_code_page_id" "uuid", "p_code" "text", "p_status" "text", "p_rewards_text" "text", "p_level_requirement" integer, "p_is_new" boolean, "p_provider_priority" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."upsert_code"("p_code_page_id" "uuid", "p_code" "text", "p_status" "text", "p_rewards_text" "text", "p_level_requirement" integer, "p_is_new" boolean, "p_provider_priority" integer) TO "service_role";



REVOKE ALL ON FUNCTION "public"."upsert_roblox_universe_stats_hourly"("p_universe_id" bigint, "p_sampled_at" timestamp with time zone, "p_playing" bigint, "p_visits" bigint, "p_favorites" bigint, "p_likes" bigint, "p_dislikes" bigint, "p_snapshot" "jsonb") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."upsert_roblox_universe_stats_hourly"("p_universe_id" bigint, "p_sampled_at" timestamp with time zone, "p_playing" bigint, "p_visits" bigint, "p_favorites" bigint, "p_likes" bigint, "p_dislikes" bigint, "p_snapshot" "jsonb") TO "service_role";



GRANT ALL ON FUNCTION "public"."upsert_search_index"("p_entity_type" "text", "p_entity_id" "text", "p_slug" "text", "p_title" "text", "p_subtitle" "text", "p_url" "text", "p_updated_at" timestamp with time zone, "p_is_published" boolean, "p_search_text" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."upsert_search_index"("p_entity_type" "text", "p_entity_id" "text", "p_slug" "text", "p_title" "text", "p_subtitle" "text", "p_url" "text", "p_updated_at" timestamp with time zone, "p_is_published" boolean, "p_search_text" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."upsert_search_index"("p_entity_type" "text", "p_entity_id" "text", "p_slug" "text", "p_title" "text", "p_subtitle" "text", "p_url" "text", "p_updated_at" timestamp with time zone, "p_is_published" boolean, "p_search_text" "text") TO "service_role";



GRANT ALL ON TABLE "public"."app_sessions" TO "anon";
GRANT ALL ON TABLE "public"."app_sessions" TO "authenticated";
GRANT ALL ON TABLE "public"."app_sessions" TO "service_role";



GRANT ALL ON TABLE "public"."app_users" TO "anon";
GRANT ALL ON TABLE "public"."app_users" TO "authenticated";
GRANT ALL ON TABLE "public"."app_users" TO "service_role";



GRANT ALL ON TABLE "public"."article_generation_artifacts" TO "anon";
GRANT ALL ON TABLE "public"."article_generation_artifacts" TO "authenticated";
GRANT ALL ON TABLE "public"."article_generation_artifacts" TO "service_role";



GRANT ALL ON TABLE "public"."articles" TO "anon";
GRANT ALL ON TABLE "public"."articles" TO "authenticated";
GRANT ALL ON TABLE "public"."articles" TO "service_role";
GRANT SELECT ON TABLE "public"."articles" TO "basebuddy_editor";



GRANT UPDATE("title") ON TABLE "public"."articles" TO "basebuddy_editor";



GRANT UPDATE("slug") ON TABLE "public"."articles" TO "basebuddy_editor";



GRANT UPDATE("content_md") ON TABLE "public"."articles" TO "basebuddy_editor";



GRANT UPDATE("cover_image") ON TABLE "public"."articles" TO "basebuddy_editor";



GRANT UPDATE("author_id") ON TABLE "public"."articles" TO "basebuddy_editor";



GRANT UPDATE("is_published") ON TABLE "public"."articles" TO "basebuddy_editor";



GRANT UPDATE("published_at") ON TABLE "public"."articles" TO "basebuddy_editor";



GRANT UPDATE("meta_description") ON TABLE "public"."articles" TO "basebuddy_editor";



GRANT UPDATE("universe_id") ON TABLE "public"."articles" TO "basebuddy_editor";



GRANT UPDATE("tags") ON TABLE "public"."articles" TO "basebuddy_editor";



GRANT UPDATE("sources") ON TABLE "public"."articles" TO "basebuddy_editor";



GRANT ALL ON TABLE "public"."authors" TO "anon";
GRANT ALL ON TABLE "public"."authors" TO "authenticated";
GRANT ALL ON TABLE "public"."authors" TO "service_role";
GRANT SELECT ON TABLE "public"."authors" TO "basebuddy_editor";



GRANT ALL ON TABLE "public"."roblox_universes" TO "anon";
GRANT ALL ON TABLE "public"."roblox_universes" TO "authenticated";
GRANT ALL ON TABLE "public"."roblox_universes" TO "service_role";
GRANT SELECT ON TABLE "public"."roblox_universes" TO "basebuddy_editor";



GRANT ALL ON TABLE "public"."article_pages_index_view" TO "anon";
GRANT ALL ON TABLE "public"."article_pages_index_view" TO "authenticated";
GRANT ALL ON TABLE "public"."article_pages_index_view" TO "service_role";



GRANT ALL ON TABLE "public"."article_pages_view" TO "postgres";
GRANT ALL ON TABLE "public"."article_pages_view" TO "anon";
GRANT ALL ON TABLE "public"."article_pages_view" TO "authenticated";
GRANT ALL ON TABLE "public"."article_pages_view" TO "service_role";



GRANT ALL ON TABLE "public"."article_source_images" TO "anon";
GRANT ALL ON TABLE "public"."article_source_images" TO "authenticated";
GRANT ALL ON TABLE "public"."article_source_images" TO "service_role";



GRANT ALL ON TABLE "public"."cache_warm_events" TO "anon";
GRANT ALL ON TABLE "public"."cache_warm_events" TO "authenticated";
GRANT ALL ON TABLE "public"."cache_warm_events" TO "service_role";



GRANT ALL ON TABLE "public"."cache_warm_worker_runs" TO "anon";
GRANT ALL ON TABLE "public"."cache_warm_worker_runs" TO "authenticated";
GRANT ALL ON TABLE "public"."cache_warm_worker_runs" TO "service_role";



GRANT ALL ON TABLE "public"."catalog_pages" TO "anon";
GRANT ALL ON TABLE "public"."catalog_pages" TO "authenticated";
GRANT ALL ON TABLE "public"."catalog_pages" TO "service_role";
GRANT SELECT ON TABLE "public"."catalog_pages" TO "basebuddy_editor";



GRANT UPDATE("title") ON TABLE "public"."catalog_pages" TO "basebuddy_editor";



GRANT UPDATE("seo_title") ON TABLE "public"."catalog_pages" TO "basebuddy_editor";



GRANT UPDATE("meta_description") ON TABLE "public"."catalog_pages" TO "basebuddy_editor";



GRANT UPDATE("intro_md") ON TABLE "public"."catalog_pages" TO "basebuddy_editor";



GRANT UPDATE("how_it_works_md") ON TABLE "public"."catalog_pages" TO "basebuddy_editor";



GRANT UPDATE("description_json") ON TABLE "public"."catalog_pages" TO "basebuddy_editor";



GRANT UPDATE("faq_json") ON TABLE "public"."catalog_pages" TO "basebuddy_editor";



GRANT UPDATE("thumb_url") ON TABLE "public"."catalog_pages" TO "basebuddy_editor";



GRANT UPDATE("is_published") ON TABLE "public"."catalog_pages" TO "basebuddy_editor";



GRANT UPDATE("published_at") ON TABLE "public"."catalog_pages" TO "basebuddy_editor";



GRANT UPDATE("wiki_md") ON TABLE "public"."catalog_pages" TO "basebuddy_editor";



GRANT UPDATE("wiki_sort_order") ON TABLE "public"."catalog_pages" TO "basebuddy_editor";



GRANT UPDATE("description_md") ON TABLE "public"."catalog_pages" TO "basebuddy_editor";



GRANT ALL ON TABLE "public"."catalog_pages_view" TO "anon";
GRANT ALL ON TABLE "public"."catalog_pages_view" TO "authenticated";
GRANT ALL ON TABLE "public"."catalog_pages_view" TO "service_role";



GRANT ALL ON TABLE "public"."checklist_items" TO "anon";
GRANT ALL ON TABLE "public"."checklist_items" TO "authenticated";
GRANT ALL ON TABLE "public"."checklist_items" TO "service_role";



GRANT ALL ON TABLE "public"."checklist_pages" TO "anon";
GRANT ALL ON TABLE "public"."checklist_pages" TO "authenticated";
GRANT ALL ON TABLE "public"."checklist_pages" TO "service_role";
GRANT SELECT ON TABLE "public"."checklist_pages" TO "basebuddy_editor";



GRANT UPDATE("title") ON TABLE "public"."checklist_pages" TO "basebuddy_editor";



GRANT UPDATE("seo_title") ON TABLE "public"."checklist_pages" TO "basebuddy_editor";



GRANT UPDATE("seo_description") ON TABLE "public"."checklist_pages" TO "basebuddy_editor";



GRANT UPDATE("published_at") ON TABLE "public"."checklist_pages" TO "basebuddy_editor";



GRANT UPDATE("is_public") ON TABLE "public"."checklist_pages" TO "basebuddy_editor";



GRANT UPDATE("description_md") ON TABLE "public"."checklist_pages" TO "basebuddy_editor";



GRANT ALL ON TABLE "public"."checklist_pages_view" TO "anon";
GRANT ALL ON TABLE "public"."checklist_pages_view" TO "authenticated";
GRANT ALL ON TABLE "public"."checklist_pages_view" TO "service_role";



GRANT ALL ON TABLE "public"."code_pages" TO "anon";
GRANT ALL ON TABLE "public"."code_pages" TO "authenticated";
GRANT ALL ON TABLE "public"."code_pages" TO "service_role";
GRANT SELECT ON TABLE "public"."code_pages" TO "basebuddy_editor";



GRANT UPDATE("name") ON TABLE "public"."code_pages" TO "basebuddy_editor";



GRANT UPDATE("source_url") ON TABLE "public"."code_pages" TO "basebuddy_editor";



GRANT UPDATE("cover_image") ON TABLE "public"."code_pages" TO "basebuddy_editor";



GRANT UPDATE("seo_description") ON TABLE "public"."code_pages" TO "basebuddy_editor";



GRANT UPDATE("is_published") ON TABLE "public"."code_pages" TO "basebuddy_editor";



GRANT UPDATE("intro_md") ON TABLE "public"."code_pages" TO "basebuddy_editor";



GRANT UPDATE("redeem_md") ON TABLE "public"."code_pages" TO "basebuddy_editor";



GRANT UPDATE("source_url_2") ON TABLE "public"."code_pages" TO "basebuddy_editor";



GRANT UPDATE("source_url_3") ON TABLE "public"."code_pages" TO "basebuddy_editor";



GRANT UPDATE("roblox_link") ON TABLE "public"."code_pages" TO "basebuddy_editor";



GRANT UPDATE("twitter_link") ON TABLE "public"."code_pages" TO "basebuddy_editor";



GRANT UPDATE("discord_link") ON TABLE "public"."code_pages" TO "basebuddy_editor";



GRANT UPDATE("community_link") ON TABLE "public"."code_pages" TO "basebuddy_editor";



GRANT UPDATE("youtube_link") ON TABLE "public"."code_pages" TO "basebuddy_editor";



GRANT UPDATE("rewards_md") ON TABLE "public"."code_pages" TO "basebuddy_editor";



GRANT UPDATE("troubleshoot_md") ON TABLE "public"."code_pages" TO "basebuddy_editor";



GRANT UPDATE("published_at") ON TABLE "public"."code_pages" TO "basebuddy_editor";



GRANT UPDATE("find_codes_md") ON TABLE "public"."code_pages" TO "basebuddy_editor";



GRANT UPDATE("source_url_4") ON TABLE "public"."code_pages" TO "basebuddy_editor";



GRANT UPDATE("source_url_5") ON TABLE "public"."code_pages" TO "basebuddy_editor";



GRANT UPDATE("source_url_6") ON TABLE "public"."code_pages" TO "basebuddy_editor";



GRANT UPDATE("source_url_7") ON TABLE "public"."code_pages" TO "basebuddy_editor";



GRANT UPDATE("source_url_8") ON TABLE "public"."code_pages" TO "basebuddy_editor";



GRANT UPDATE("source_url_9") ON TABLE "public"."code_pages" TO "basebuddy_editor";



GRANT UPDATE("source_url_10") ON TABLE "public"."code_pages" TO "basebuddy_editor";



GRANT ALL ON TABLE "public"."codes" TO "anon";
GRANT ALL ON TABLE "public"."codes" TO "authenticated";
GRANT ALL ON TABLE "public"."codes" TO "service_role";



GRANT ALL ON TABLE "public"."code_page_code_stats" TO "anon";
GRANT ALL ON TABLE "public"."code_page_code_stats" TO "authenticated";
GRANT ALL ON TABLE "public"."code_page_code_stats" TO "service_role";



GRANT ALL ON TABLE "public"."code_pages_index_view" TO "anon";
GRANT ALL ON TABLE "public"."code_pages_index_view" TO "authenticated";
GRANT ALL ON TABLE "public"."code_pages_index_view" TO "service_role";



GRANT ALL ON TABLE "public"."code_pages_view" TO "anon";
GRANT ALL ON TABLE "public"."code_pages_view" TO "authenticated";
GRANT ALL ON TABLE "public"."code_pages_view" TO "service_role";



GRANT ALL ON TABLE "public"."comments" TO "anon";
GRANT ALL ON TABLE "public"."comments" TO "authenticated";
GRANT ALL ON TABLE "public"."comments" TO "service_role";



GRANT ALL ON TABLE "public"."event_guide_generation_queue" TO "anon";
GRANT ALL ON TABLE "public"."event_guide_generation_queue" TO "authenticated";
GRANT ALL ON TABLE "public"."event_guide_generation_queue" TO "service_role";



GRANT ALL ON TABLE "public"."events_pages" TO "anon";
GRANT ALL ON TABLE "public"."events_pages" TO "authenticated";
GRANT ALL ON TABLE "public"."events_pages" TO "service_role";
GRANT SELECT ON TABLE "public"."events_pages" TO "basebuddy_editor";



GRANT UPDATE("title") ON TABLE "public"."events_pages" TO "basebuddy_editor";



GRANT UPDATE("content_md") ON TABLE "public"."events_pages" TO "basebuddy_editor";



GRANT UPDATE("seo_title") ON TABLE "public"."events_pages" TO "basebuddy_editor";



GRANT UPDATE("meta_description") ON TABLE "public"."events_pages" TO "basebuddy_editor";



GRANT UPDATE("is_published") ON TABLE "public"."events_pages" TO "basebuddy_editor";



GRANT UPDATE("published_at") ON TABLE "public"."events_pages" TO "basebuddy_editor";



GRANT UPDATE("slug") ON TABLE "public"."events_pages" TO "basebuddy_editor";



GRANT ALL ON TABLE "public"."game_generation_queue" TO "anon";
GRANT ALL ON TABLE "public"."game_generation_queue" TO "authenticated";
GRANT ALL ON TABLE "public"."game_generation_queue" TO "service_role";



GRANT ALL ON TABLE "public"."google_indexing_attempts" TO "anon";
GRANT ALL ON TABLE "public"."google_indexing_attempts" TO "authenticated";
GRANT ALL ON TABLE "public"."google_indexing_attempts" TO "service_role";



GRANT ALL ON SEQUENCE "public"."google_indexing_attempts_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."google_indexing_attempts_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."google_indexing_attempts_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."google_indexing_url_state" TO "anon";
GRANT ALL ON TABLE "public"."google_indexing_url_state" TO "authenticated";
GRANT ALL ON TABLE "public"."google_indexing_url_state" TO "service_role";



GRANT ALL ON TABLE "public"."roblox_catalog_items" TO "anon";
GRANT ALL ON TABLE "public"."roblox_catalog_items" TO "authenticated";
GRANT ALL ON TABLE "public"."roblox_catalog_items" TO "service_role";



GRANT ALL ON TABLE "public"."limited_items_trading_view" TO "anon";
GRANT ALL ON TABLE "public"."limited_items_trading_view" TO "authenticated";
GRANT ALL ON TABLE "public"."limited_items_trading_view" TO "service_role";



GRANT ALL ON TABLE "public"."puzzle_answers" TO "anon";
GRANT ALL ON TABLE "public"."puzzle_answers" TO "authenticated";
GRANT ALL ON TABLE "public"."puzzle_answers" TO "service_role";



GRANT ALL ON TABLE "public"."puzzle_pages" TO "anon";
GRANT ALL ON TABLE "public"."puzzle_pages" TO "authenticated";
GRANT ALL ON TABLE "public"."puzzle_pages" TO "service_role";



GRANT ALL ON TABLE "public"."puzzle_pages_view" TO "anon";
GRANT ALL ON TABLE "public"."puzzle_pages_view" TO "authenticated";
GRANT ALL ON TABLE "public"."puzzle_pages_view" TO "service_role";



GRANT ALL ON TABLE "public"."puzzle_sync_runs" TO "anon";
GRANT ALL ON TABLE "public"."puzzle_sync_runs" TO "authenticated";
GRANT ALL ON TABLE "public"."puzzle_sync_runs" TO "service_role";



GRANT ALL ON TABLE "public"."quiz_pages" TO "anon";
GRANT ALL ON TABLE "public"."quiz_pages" TO "authenticated";
GRANT ALL ON TABLE "public"."quiz_pages" TO "service_role";
GRANT SELECT ON TABLE "public"."quiz_pages" TO "basebuddy_editor";



GRANT UPDATE("title") ON TABLE "public"."quiz_pages" TO "basebuddy_editor";



GRANT UPDATE("description_md") ON TABLE "public"."quiz_pages" TO "basebuddy_editor";



GRANT UPDATE("seo_title") ON TABLE "public"."quiz_pages" TO "basebuddy_editor";



GRANT UPDATE("seo_description") ON TABLE "public"."quiz_pages" TO "basebuddy_editor";



GRANT UPDATE("is_published") ON TABLE "public"."quiz_pages" TO "basebuddy_editor";



GRANT UPDATE("published_at") ON TABLE "public"."quiz_pages" TO "basebuddy_editor";



GRANT UPDATE("about_md") ON TABLE "public"."quiz_pages" TO "basebuddy_editor";



GRANT ALL ON TABLE "public"."quiz_pages_view" TO "anon";
GRANT ALL ON TABLE "public"."quiz_pages_view" TO "authenticated";
GRANT ALL ON TABLE "public"."quiz_pages_view" TO "service_role";



GRANT ALL ON TABLE "public"."revalidation_events" TO "anon";
GRANT ALL ON TABLE "public"."revalidation_events" TO "authenticated";
GRANT ALL ON TABLE "public"."revalidation_events" TO "service_role";
GRANT SELECT,INSERT,UPDATE ON TABLE "public"."revalidation_events" TO "basebuddy_editor";



GRANT SELECT("entity_type"),INSERT("entity_type") ON TABLE "public"."revalidation_events" TO "basebuddy_editor";



GRANT SELECT("slug"),INSERT("slug") ON TABLE "public"."revalidation_events" TO "basebuddy_editor";



GRANT INSERT("source"),UPDATE("source") ON TABLE "public"."revalidation_events" TO "basebuddy_editor";



GRANT UPDATE("created_at") ON TABLE "public"."revalidation_events" TO "basebuddy_editor";



GRANT ALL ON TABLE "public"."revalidation_worker_runs" TO "anon";
GRANT ALL ON TABLE "public"."revalidation_worker_runs" TO "authenticated";
GRANT ALL ON TABLE "public"."revalidation_worker_runs" TO "service_role";



GRANT ALL ON TABLE "public"."roblox_catalog_categories" TO "anon";
GRANT ALL ON TABLE "public"."roblox_catalog_categories" TO "authenticated";
GRANT ALL ON TABLE "public"."roblox_catalog_categories" TO "service_role";



GRANT ALL ON TABLE "public"."roblox_catalog_discovery_hits" TO "anon";
GRANT ALL ON TABLE "public"."roblox_catalog_discovery_hits" TO "authenticated";
GRANT ALL ON TABLE "public"."roblox_catalog_discovery_hits" TO "service_role";



GRANT ALL ON TABLE "public"."roblox_catalog_discovery_runs" TO "anon";
GRANT ALL ON TABLE "public"."roblox_catalog_discovery_runs" TO "authenticated";
GRANT ALL ON TABLE "public"."roblox_catalog_discovery_runs" TO "service_role";



GRANT ALL ON TABLE "public"."roblox_catalog_item_images" TO "anon";
GRANT ALL ON TABLE "public"."roblox_catalog_item_images" TO "authenticated";
GRANT ALL ON TABLE "public"."roblox_catalog_item_images" TO "service_role";



GRANT ALL ON TABLE "public"."roblox_catalog_item_resale_points" TO "postgres";
GRANT ALL ON TABLE "public"."roblox_catalog_item_resale_points" TO "anon";
GRANT ALL ON TABLE "public"."roblox_catalog_item_resale_points" TO "authenticated";
GRANT ALL ON TABLE "public"."roblox_catalog_item_resale_points" TO "service_role";



GRANT ALL ON TABLE "public"."roblox_catalog_item_stats_daily" TO "postgres";
GRANT ALL ON TABLE "public"."roblox_catalog_item_stats_daily" TO "anon";
GRANT ALL ON TABLE "public"."roblox_catalog_item_stats_daily" TO "authenticated";
GRANT ALL ON TABLE "public"."roblox_catalog_item_stats_daily" TO "service_role";



GRANT ALL ON TABLE "public"."roblox_catalog_item_stats_hourly" TO "postgres";
GRANT ALL ON TABLE "public"."roblox_catalog_item_stats_hourly" TO "anon";
GRANT ALL ON TABLE "public"."roblox_catalog_item_stats_hourly" TO "authenticated";
GRANT ALL ON TABLE "public"."roblox_catalog_item_stats_hourly" TO "service_role";



GRANT ALL ON TABLE "public"."roblox_catalog_items_history" TO "anon";
GRANT ALL ON TABLE "public"."roblox_catalog_items_history" TO "authenticated";
GRANT ALL ON TABLE "public"."roblox_catalog_items_history" TO "service_role";



GRANT ALL ON TABLE "public"."roblox_catalog_refresh_queue" TO "anon";
GRANT ALL ON TABLE "public"."roblox_catalog_refresh_queue" TO "authenticated";
GRANT ALL ON TABLE "public"."roblox_catalog_refresh_queue" TO "service_role";



GRANT ALL ON TABLE "public"."roblox_catalog_subcategories" TO "anon";
GRANT ALL ON TABLE "public"."roblox_catalog_subcategories" TO "authenticated";
GRANT ALL ON TABLE "public"."roblox_catalog_subcategories" TO "service_role";



GRANT ALL ON TABLE "public"."roblox_decal_ids" TO "postgres";
GRANT ALL ON TABLE "public"."roblox_decal_ids" TO "anon";
GRANT ALL ON TABLE "public"."roblox_decal_ids" TO "authenticated";
GRANT ALL ON TABLE "public"."roblox_decal_ids" TO "service_role";



GRANT ALL ON TABLE "public"."roblox_decal_categories_view" TO "postgres";
GRANT ALL ON TABLE "public"."roblox_decal_categories_view" TO "anon";
GRANT ALL ON TABLE "public"."roblox_decal_categories_view" TO "authenticated";
GRANT ALL ON TABLE "public"."roblox_decal_categories_view" TO "service_role";



GRANT ALL ON TABLE "public"."roblox_decal_id_sources" TO "postgres";
GRANT ALL ON TABLE "public"."roblox_decal_id_sources" TO "anon";
GRANT ALL ON TABLE "public"."roblox_decal_id_sources" TO "authenticated";
GRANT ALL ON TABLE "public"."roblox_decal_id_sources" TO "service_role";



GRANT ALL ON TABLE "public"."roblox_decal_ids_ranked_view" TO "postgres";
GRANT ALL ON TABLE "public"."roblox_decal_ids_ranked_view" TO "anon";
GRANT ALL ON TABLE "public"."roblox_decal_ids_ranked_view" TO "authenticated";
GRANT ALL ON TABLE "public"."roblox_decal_ids_ranked_view" TO "service_role";



GRANT ALL ON TABLE "public"."roblox_groups" TO "anon";
GRANT ALL ON TABLE "public"."roblox_groups" TO "authenticated";
GRANT ALL ON TABLE "public"."roblox_groups" TO "service_role";



GRANT ALL ON TABLE "public"."roblox_music_ids" TO "anon";
GRANT ALL ON TABLE "public"."roblox_music_ids" TO "authenticated";
GRANT ALL ON TABLE "public"."roblox_music_ids" TO "service_role";



GRANT ALL ON TABLE "public"."roblox_music_artists_view" TO "anon";
GRANT ALL ON TABLE "public"."roblox_music_artists_view" TO "authenticated";
GRANT ALL ON TABLE "public"."roblox_music_artists_view" TO "service_role";



GRANT ALL ON TABLE "public"."roblox_music_genres_view" TO "anon";
GRANT ALL ON TABLE "public"."roblox_music_genres_view" TO "authenticated";
GRANT ALL ON TABLE "public"."roblox_music_genres_view" TO "service_role";



GRANT ALL ON TABLE "public"."roblox_music_ids_boombox_view" TO "anon";
GRANT ALL ON TABLE "public"."roblox_music_ids_boombox_view" TO "authenticated";
GRANT ALL ON TABLE "public"."roblox_music_ids_boombox_view" TO "service_role";



GRANT ALL ON TABLE "public"."roblox_music_ids_ranked_view" TO "anon";
GRANT ALL ON TABLE "public"."roblox_music_ids_ranked_view" TO "authenticated";
GRANT ALL ON TABLE "public"."roblox_music_ids_ranked_view" TO "service_role";



GRANT ALL ON TABLE "public"."roblox_promo_rewards" TO "service_role";



GRANT ALL ON TABLE "public"."roblox_universe_badges" TO "anon";
GRANT ALL ON TABLE "public"."roblox_universe_badges" TO "authenticated";
GRANT ALL ON TABLE "public"."roblox_universe_badges" TO "service_role";



GRANT ALL ON TABLE "public"."roblox_universe_gamepasses" TO "anon";
GRANT ALL ON TABLE "public"."roblox_universe_gamepasses" TO "authenticated";
GRANT ALL ON TABLE "public"."roblox_universe_gamepasses" TO "service_role";



GRANT ALL ON TABLE "public"."roblox_universe_media" TO "anon";
GRANT ALL ON TABLE "public"."roblox_universe_media" TO "authenticated";
GRANT ALL ON TABLE "public"."roblox_universe_media" TO "service_role";



GRANT ALL ON TABLE "public"."roblox_universe_place_servers" TO "anon";
GRANT ALL ON TABLE "public"."roblox_universe_place_servers" TO "authenticated";
GRANT ALL ON TABLE "public"."roblox_universe_place_servers" TO "service_role";



GRANT ALL ON TABLE "public"."roblox_universe_rank_snapshots" TO "anon";
GRANT ALL ON TABLE "public"."roblox_universe_rank_snapshots" TO "authenticated";
GRANT ALL ON TABLE "public"."roblox_universe_rank_snapshots" TO "service_role";



GRANT ALL ON TABLE "public"."roblox_universe_rank_snapshots_daily" TO "anon";
GRANT ALL ON TABLE "public"."roblox_universe_rank_snapshots_daily" TO "authenticated";
GRANT ALL ON TABLE "public"."roblox_universe_rank_snapshots_daily" TO "service_role";



GRANT ALL ON TABLE "public"."roblox_universe_rank_snapshots_hourly" TO "anon";
GRANT ALL ON TABLE "public"."roblox_universe_rank_snapshots_hourly" TO "authenticated";
GRANT ALL ON TABLE "public"."roblox_universe_rank_snapshots_hourly" TO "service_role";



GRANT ALL ON TABLE "public"."roblox_universe_social_links" TO "anon";
GRANT ALL ON TABLE "public"."roblox_universe_social_links" TO "authenticated";
GRANT ALL ON TABLE "public"."roblox_universe_social_links" TO "service_role";



GRANT ALL ON TABLE "public"."roblox_universe_stats_daily" TO "anon";
GRANT ALL ON TABLE "public"."roblox_universe_stats_daily" TO "authenticated";
GRANT ALL ON TABLE "public"."roblox_universe_stats_daily" TO "service_role";



GRANT ALL ON TABLE "public"."roblox_universe_stats_hourly" TO "anon";
GRANT ALL ON TABLE "public"."roblox_universe_stats_hourly" TO "authenticated";
GRANT ALL ON TABLE "public"."roblox_universe_stats_hourly" TO "service_role";



GRANT ALL ON TABLE "public"."roblox_universe_update_events" TO "anon";
GRANT ALL ON TABLE "public"."roblox_universe_update_events" TO "authenticated";
GRANT ALL ON TABLE "public"."roblox_universe_update_events" TO "service_role";



GRANT ALL ON TABLE "public"."roblox_virtual_event_categories" TO "anon";
GRANT ALL ON TABLE "public"."roblox_virtual_event_categories" TO "authenticated";
GRANT ALL ON TABLE "public"."roblox_virtual_event_categories" TO "service_role";



GRANT ALL ON TABLE "public"."roblox_virtual_event_thumbnails" TO "anon";
GRANT ALL ON TABLE "public"."roblox_virtual_event_thumbnails" TO "authenticated";
GRANT ALL ON TABLE "public"."roblox_virtual_event_thumbnails" TO "service_role";



GRANT ALL ON TABLE "public"."roblox_virtual_events" TO "anon";
GRANT ALL ON TABLE "public"."roblox_virtual_events" TO "authenticated";
GRANT ALL ON TABLE "public"."roblox_virtual_events" TO "service_role";



GRANT ALL ON TABLE "public"."search_index" TO "anon";
GRANT ALL ON TABLE "public"."search_index" TO "authenticated";
GRANT ALL ON TABLE "public"."search_index" TO "service_role";
GRANT SELECT,INSERT,UPDATE ON TABLE "public"."search_index" TO "basebuddy_editor";



GRANT SELECT("entity_type"),INSERT("entity_type") ON TABLE "public"."search_index" TO "basebuddy_editor";



GRANT SELECT("entity_id"),INSERT("entity_id") ON TABLE "public"."search_index" TO "basebuddy_editor";



GRANT INSERT("slug"),UPDATE("slug") ON TABLE "public"."search_index" TO "basebuddy_editor";



GRANT INSERT("title"),UPDATE("title") ON TABLE "public"."search_index" TO "basebuddy_editor";



GRANT INSERT("subtitle"),UPDATE("subtitle") ON TABLE "public"."search_index" TO "basebuddy_editor";



GRANT INSERT("url"),UPDATE("url") ON TABLE "public"."search_index" TO "basebuddy_editor";



GRANT INSERT("updated_at"),UPDATE("updated_at") ON TABLE "public"."search_index" TO "basebuddy_editor";



GRANT INSERT("is_published"),UPDATE("is_published") ON TABLE "public"."search_index" TO "basebuddy_editor";



GRANT INSERT("search_text"),UPDATE("search_text") ON TABLE "public"."search_index" TO "basebuddy_editor";



GRANT ALL ON TABLE "public"."site_feedback" TO "anon";
GRANT ALL ON TABLE "public"."site_feedback" TO "authenticated";
GRANT ALL ON TABLE "public"."site_feedback" TO "service_role";



GRANT ALL ON TABLE "public"."stats_creator_current_index" TO "anon";
GRANT ALL ON TABLE "public"."stats_creator_current_index" TO "authenticated";
GRANT ALL ON TABLE "public"."stats_creator_current_index" TO "service_role";



GRANT ALL ON TABLE "public"."stats_game_current_index" TO "anon";
GRANT ALL ON TABLE "public"."stats_game_current_index" TO "authenticated";
GRANT ALL ON TABLE "public"."stats_game_current_index" TO "service_role";



GRANT ALL ON TABLE "public"."stats_genre_current_index" TO "anon";
GRANT ALL ON TABLE "public"."stats_genre_current_index" TO "authenticated";
GRANT ALL ON TABLE "public"."stats_genre_current_index" TO "service_role";



GRANT ALL ON TABLE "public"."stats_item_current_index" TO "postgres";
GRANT ALL ON TABLE "public"."stats_item_current_index" TO "anon";
GRANT ALL ON TABLE "public"."stats_item_current_index" TO "authenticated";
GRANT ALL ON TABLE "public"."stats_item_current_index" TO "service_role";



GRANT ALL ON TABLE "public"."stats_item_price_movers_current_index" TO "postgres";
GRANT ALL ON TABLE "public"."stats_item_price_movers_current_index" TO "anon";
GRANT ALL ON TABLE "public"."stats_item_price_movers_current_index" TO "authenticated";
GRANT ALL ON TABLE "public"."stats_item_price_movers_current_index" TO "service_role";



GRANT ALL ON TABLE "public"."stats_job_runs" TO "anon";
GRANT ALL ON TABLE "public"."stats_job_runs" TO "authenticated";
GRANT ALL ON TABLE "public"."stats_job_runs" TO "service_role";



GRANT ALL ON TABLE "public"."stats_risers_current_index" TO "anon";
GRANT ALL ON TABLE "public"."stats_risers_current_index" TO "authenticated";
GRANT ALL ON TABLE "public"."stats_risers_current_index" TO "service_role";



GRANT ALL ON TABLE "public"."tools" TO "anon";
GRANT ALL ON TABLE "public"."tools" TO "authenticated";
GRANT ALL ON TABLE "public"."tools" TO "service_role";
GRANT SELECT ON TABLE "public"."tools" TO "basebuddy_editor";



GRANT UPDATE("title") ON TABLE "public"."tools" TO "basebuddy_editor";



GRANT UPDATE("seo_title") ON TABLE "public"."tools" TO "basebuddy_editor";



GRANT UPDATE("meta_description") ON TABLE "public"."tools" TO "basebuddy_editor";



GRANT UPDATE("intro_md") ON TABLE "public"."tools" TO "basebuddy_editor";



GRANT UPDATE("how_it_works_md") ON TABLE "public"."tools" TO "basebuddy_editor";



GRANT UPDATE("description_json") ON TABLE "public"."tools" TO "basebuddy_editor";



GRANT UPDATE("faq_json") ON TABLE "public"."tools" TO "basebuddy_editor";



GRANT UPDATE("cta_label") ON TABLE "public"."tools" TO "basebuddy_editor";



GRANT UPDATE("cta_url") ON TABLE "public"."tools" TO "basebuddy_editor";



GRANT UPDATE("thumb_url") ON TABLE "public"."tools" TO "basebuddy_editor";



GRANT UPDATE("is_published") ON TABLE "public"."tools" TO "basebuddy_editor";



GRANT UPDATE("published_at") ON TABLE "public"."tools" TO "basebuddy_editor";



GRANT ALL ON TABLE "public"."tools_view" TO "anon";
GRANT ALL ON TABLE "public"."tools_view" TO "authenticated";
GRANT ALL ON TABLE "public"."tools_view" TO "service_role";



GRANT ALL ON TABLE "public"."user_checklist_progress" TO "anon";
GRANT ALL ON TABLE "public"."user_checklist_progress" TO "authenticated";
GRANT ALL ON TABLE "public"."user_checklist_progress" TO "service_role";



GRANT ALL ON TABLE "public"."user_code_progress" TO "anon";
GRANT ALL ON TABLE "public"."user_code_progress" TO "authenticated";
GRANT ALL ON TABLE "public"."user_code_progress" TO "service_role";



GRANT ALL ON TABLE "public"."user_quiz_progress" TO "anon";
GRANT ALL ON TABLE "public"."user_quiz_progress" TO "authenticated";
GRANT ALL ON TABLE "public"."user_quiz_progress" TO "service_role";



GRANT ALL ON TABLE "public"."wiki_collection_pages" TO "anon";
GRANT ALL ON TABLE "public"."wiki_collection_pages" TO "authenticated";
GRANT ALL ON TABLE "public"."wiki_collection_pages" TO "service_role";
GRANT SELECT ON TABLE "public"."wiki_collection_pages" TO "basebuddy_editor";



GRANT UPDATE("title") ON TABLE "public"."wiki_collection_pages" TO "basebuddy_editor";



GRANT UPDATE("seo_title") ON TABLE "public"."wiki_collection_pages" TO "basebuddy_editor";



GRANT UPDATE("meta_description") ON TABLE "public"."wiki_collection_pages" TO "basebuddy_editor";



GRANT UPDATE("intro_md") ON TABLE "public"."wiki_collection_pages" TO "basebuddy_editor";



GRANT UPDATE("how_it_works_md") ON TABLE "public"."wiki_collection_pages" TO "basebuddy_editor";



GRANT UPDATE("description_md") ON TABLE "public"."wiki_collection_pages" TO "basebuddy_editor";



GRANT UPDATE("description_json") ON TABLE "public"."wiki_collection_pages" TO "basebuddy_editor";



GRANT UPDATE("faq_json") ON TABLE "public"."wiki_collection_pages" TO "basebuddy_editor";



GRANT UPDATE("thumb_url") ON TABLE "public"."wiki_collection_pages" TO "basebuddy_editor";



GRANT UPDATE("wiki_md") ON TABLE "public"."wiki_collection_pages" TO "basebuddy_editor";



GRANT UPDATE("wiki_sort_order") ON TABLE "public"."wiki_collection_pages" TO "basebuddy_editor";



GRANT UPDATE("is_published") ON TABLE "public"."wiki_collection_pages" TO "basebuddy_editor";



GRANT UPDATE("published_at") ON TABLE "public"."wiki_collection_pages" TO "basebuddy_editor";



GRANT ALL ON TABLE "public"."wiki_collection_pages_view" TO "anon";
GRANT ALL ON TABLE "public"."wiki_collection_pages_view" TO "authenticated";
GRANT ALL ON TABLE "public"."wiki_collection_pages_view" TO "service_role";



GRANT ALL ON TABLE "public"."wiki_pages" TO "anon";
GRANT ALL ON TABLE "public"."wiki_pages" TO "authenticated";
GRANT ALL ON TABLE "public"."wiki_pages" TO "service_role";
GRANT SELECT ON TABLE "public"."wiki_pages" TO "basebuddy_editor";



GRANT UPDATE("title") ON TABLE "public"."wiki_pages" TO "basebuddy_editor";



GRANT UPDATE("seo_title") ON TABLE "public"."wiki_pages" TO "basebuddy_editor";



GRANT UPDATE("meta_description") ON TABLE "public"."wiki_pages" TO "basebuddy_editor";



GRANT UPDATE("controls_json") ON TABLE "public"."wiki_pages" TO "basebuddy_editor";



GRANT UPDATE("tips_md") ON TABLE "public"."wiki_pages" TO "basebuddy_editor";



GRANT UPDATE("is_published") ON TABLE "public"."wiki_pages" TO "basebuddy_editor";



GRANT UPDATE("published_at") ON TABLE "public"."wiki_pages" TO "basebuddy_editor";



GRANT UPDATE("cover_image") ON TABLE "public"."wiki_pages" TO "basebuddy_editor";



GRANT ALL ON TABLE "public"."wiki_pages_view" TO "anon";
GRANT ALL ON TABLE "public"."wiki_pages_view" TO "authenticated";
GRANT ALL ON TABLE "public"."wiki_pages_view" TO "service_role";












ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "service_role";
