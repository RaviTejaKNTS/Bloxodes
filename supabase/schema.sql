


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


CREATE OR REPLACE FUNCTION "public"."enqueue_list_revalidation_for_universe"("p_universe_id" bigint, "p_source" "text") RETURNS "void"
    LANGUAGE "plpgsql"
    AS $$
begin
  if p_universe_id is null then
    return;
  end if;

  insert into public.revalidation_events (entity_type, slug, source)
  select distinct 'list', lower(gl.slug), p_source
  from public.game_lists gl
  join public.game_list_entries gle on gle.list_id = gl.id
  where gle.universe_id = p_universe_id
    and gl.is_published = true
    and gl.slug is not null
    and trim(gl.slug) <> ''
  on conflict (entity_type, slug)
  do update set
    created_at = now(),
    source = excluded.source;
end;
$$;


ALTER FUNCTION "public"."enqueue_list_revalidation_for_universe"("p_universe_id" bigint, "p_source" "text") OWNER TO "postgres";


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


CREATE OR REPLACE FUNCTION "public"."enqueue_wiki_revalidation_for_list"("p_list_id" "uuid", "p_source" "text") RETURNS "void"
    LANGUAGE "plpgsql"
    AS $$
declare
  target_universe_id bigint;
begin
  if p_list_id is null then
    return;
  end if;

  for target_universe_id in
    select distinct gle.universe_id
    from public.game_list_entries gle
    where gle.list_id = p_list_id
      and gle.rank between 1 and 3
      and gle.universe_id is not null
  loop
    perform public.enqueue_wiki_revalidation_for_universe(target_universe_id, p_source);
  end loop;
end;
$$;


ALTER FUNCTION "public"."enqueue_wiki_revalidation_for_list"("p_list_id" "uuid", "p_source" "text") OWNER TO "postgres";


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
    url := 'https://bmwksaykcsndsvgspapz.supabase.co/functions/v1/revalidate',
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


CREATE OR REPLACE FUNCTION "public"."qualifies_for_free_items_catalog"("p_price_robux" bigint, "p_is_deleted" boolean, "p_raw_economy_json" "jsonb", "p_has_resellers" boolean, "p_lowest_resale_price_robux" bigint, "p_name" "text", "p_category" "text", "p_subcategory" "text", "p_favorite_count" bigint) RETURNS boolean
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


ALTER FUNCTION "public"."qualifies_for_free_items_catalog"("p_price_robux" bigint, "p_is_deleted" boolean, "p_raw_economy_json" "jsonb", "p_has_resellers" boolean, "p_lowest_resale_price_robux" bigint, "p_name" "text", "p_category" "text", "p_subcategory" "text", "p_favorite_count" bigint) OWNER TO "postgres";


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


CREATE OR REPLACE FUNCTION "public"."run_game_list_sql"("sql_text" "text", "limit_count" integer DEFAULT NULL::integer) RETURNS TABLE("universe_id" bigint, "rank" integer, "metric_value" numeric, "reason" "text", "extra" "jsonb", "game_id" "uuid", "playing" bigint, "visits" bigint, "favorites" bigint, "likes" bigint, "dislikes" bigint)
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


ALTER FUNCTION "public"."run_game_list_sql"("sql_text" "text", "limit_count" integer) OWNER TO "postgres";


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


CREATE OR REPLACE FUNCTION "public"."set_game_published_at"() RETURNS "trigger"
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


ALTER FUNCTION "public"."set_game_published_at"() OWNER TO "postgres";


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


CREATE OR REPLACE FUNCTION "public"."trg_comments_revalidate_code"() RETURNS "trigger"
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


ALTER FUNCTION "public"."trg_comments_revalidate_code"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."trg_comments_revalidate_entity"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
declare
  target_entity_type text;
  target_entity_id uuid;
  should_revalidate boolean := false;
begin
  if tg_op = 'DELETE' then
    target_entity_type := old.entity_type;
    target_entity_id := old.entity_id;
    should_revalidate := old.status = 'approved';
  elsif tg_op = 'INSERT' then
    target_entity_type := new.entity_type;
    target_entity_id := new.entity_id;
    should_revalidate := new.status = 'approved';
  else
    target_entity_type := new.entity_type;
    target_entity_id := new.entity_id;
    should_revalidate :=
      old.status = 'approved'
      or new.status = 'approved'
      or old.body_md is distinct from new.body_md
      or old.entity_type is distinct from new.entity_type
      or old.entity_id is distinct from new.entity_id;
  end if;

  if not should_revalidate or target_entity_id is null then
    return null;
  end if;

  if target_entity_type = 'code' then
    insert into public.revalidation_events (entity_type, slug, source)
    select 'code', lower(g.slug), 'comments_code_' || lower(tg_op)
    from public.games g
    where g.id = target_entity_id
      and g.is_published = true
      and g.slug is not null
      and trim(g.slug) <> ''
    on conflict (entity_type, slug)
    do update set created_at = now(), source = excluded.source;
  elsif target_entity_type = 'article' then
    insert into public.revalidation_events (entity_type, slug, source)
    select 'article', lower(a.slug), 'comments_article_' || lower(tg_op)
    from public.articles a
    where a.id = target_entity_id
      and a.is_published = true
      and a.slug is not null
      and trim(a.slug) <> ''
    on conflict (entity_type, slug)
    do update set created_at = now(), source = excluded.source;
  elsif target_entity_type = 'catalog' then
    insert into public.revalidation_events (entity_type, slug, source)
    select 'catalog', lower(c.code), 'comments_catalog_' || lower(tg_op)
    from public.catalog_pages c
    where c.id = target_entity_id
      and c.is_published = true
      and c.code is not null
      and trim(c.code) <> ''
    on conflict (entity_type, slug)
    do update set created_at = now(), source = excluded.source;
  elsif target_entity_type = 'event' then
    insert into public.revalidation_events (entity_type, slug, source)
    select 'event', lower(e.slug), 'comments_event_' || lower(tg_op)
    from public.events_pages e
    where e.id = target_entity_id
      and e.is_published = true
      and e.slug is not null
      and trim(e.slug) <> ''
    on conflict (entity_type, slug)
    do update set created_at = now(), source = excluded.source;
  elsif target_entity_type = 'list' then
    insert into public.revalidation_events (entity_type, slug, source)
    select 'list', lower(gl.slug), 'comments_list_' || lower(tg_op)
    from public.game_lists gl
    where gl.id = target_entity_id
      and gl.is_published = true
      and gl.slug is not null
      and trim(gl.slug) <> ''
    on conflict (entity_type, slug)
    do update set created_at = now(), source = excluded.source;
  elsif target_entity_type = 'tool' then
    insert into public.revalidation_events (entity_type, slug, source)
    select 'tool', lower(t.code), 'comments_tool_' || lower(tg_op)
    from public.tools t
    where t.id = target_entity_id
      and t.is_published = true
      and t.code is not null
      and trim(t.code) <> ''
    on conflict (entity_type, slug)
    do update set created_at = now(), source = excluded.source;
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


CREATE OR REPLACE FUNCTION "public"."trg_enqueue_revalidation_codes"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
declare
  target_game_ids uuid[];
  game_record record;
begin
  if tg_op = 'DELETE' then
    target_game_ids := array_remove(array[old.game_id], null);
  elsif tg_op = 'INSERT' then
    target_game_ids := array_remove(array[new.game_id], null);
  else
    target_game_ids := array_remove(array[old.game_id, new.game_id], null);
  end if;

  for game_record in
    select distinct g.id, g.slug, g.universe_id
    from public.games g
    where g.id = any(target_game_ids)
      and g.is_published = true
      and g.slug is not null
      and trim(g.slug) <> ''
  loop
    perform public.enqueue_revalidation('code', game_record.slug, 'codes_' || lower(tg_op));
    perform public.enqueue_list_revalidation_for_universe(game_record.universe_id, 'codes_lists_' || lower(tg_op));
  end loop;

  return null;
end;
$$;


ALTER FUNCTION "public"."trg_enqueue_revalidation_codes"() OWNER TO "postgres";


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
    item_record.raw_economy_json,
    item_record.has_resellers,
    item_record.lowest_resale_price_robux,
    item_record.name,
    item_record.category,
    item_record.subcategory,
    item_record.favorite_count
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


CREATE OR REPLACE FUNCTION "public"."trg_enqueue_revalidation_game_list_entries"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
declare
  target_list_ids uuid[];
  list_slug text;
begin
  if tg_op = 'DELETE' then
    target_list_ids := array_remove(array[old.list_id], null);
    perform public.enqueue_wiki_revalidation_for_universe(old.universe_id, 'game_list_entries_wiki_delete');
  elsif tg_op = 'INSERT' then
    target_list_ids := array_remove(array[new.list_id], null);
    perform public.enqueue_wiki_revalidation_for_universe(new.universe_id, 'game_list_entries_wiki_insert');
  else
    target_list_ids := array_remove(array[old.list_id, new.list_id], null);
    perform public.enqueue_wiki_revalidation_for_universe(old.universe_id, 'game_list_entries_wiki_update_old');
    perform public.enqueue_wiki_revalidation_for_universe(new.universe_id, 'game_list_entries_wiki_update');
  end if;

  for list_slug in
    select distinct gl.slug
    from public.game_lists gl
    where gl.id = any(target_list_ids)
      and gl.is_published = true
      and gl.slug is not null
      and trim(gl.slug) <> ''
  loop
    perform public.enqueue_revalidation('list', list_slug, 'game_list_entries_' || lower(tg_op));
  end loop;

  return null;
end;
$$;


ALTER FUNCTION "public"."trg_enqueue_revalidation_game_list_entries"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."trg_enqueue_revalidation_game_lists"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
begin
  if tg_op = 'DELETE' then
    if old.is_published = true then
      perform public.enqueue_revalidation('list', old.slug, 'game_lists_delete');
      perform public.enqueue_wiki_revalidation_for_list(old.id, 'game_lists_wiki_delete');
    end if;
    return null;
  end if;

  if new.is_published = true then
    perform public.enqueue_revalidation('list', new.slug, 'game_lists_' || lower(tg_op));
    perform public.enqueue_wiki_revalidation_for_list(new.id, 'game_lists_wiki_' || lower(tg_op));
  end if;

  if tg_op = 'UPDATE' and old.is_published = true then
    perform public.enqueue_wiki_revalidation_for_list(old.id, 'game_lists_wiki_update_old');

    if old.slug is distinct from new.slug or new.is_published is distinct from true then
      perform public.enqueue_revalidation('list', old.slug, 'game_lists_old_slug_or_unpublish');
    end if;
  end if;

  return null;
end;
$$;


ALTER FUNCTION "public"."trg_enqueue_revalidation_game_lists"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."trg_enqueue_revalidation_games"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
begin
  if tg_op = 'DELETE' then
    if old.is_published = true then
      perform public.enqueue_revalidation('code', old.slug, 'games_delete');
      perform public.enqueue_list_revalidation_for_universe(old.universe_id, 'games_lists_delete');
      perform public.enqueue_wiki_revalidation_for_universe(old.universe_id, 'games_wiki_delete');
    end if;
    return null;
  end if;

  if new.is_published = true then
    perform public.enqueue_revalidation('code', new.slug, 'games_' || lower(tg_op));
    perform public.enqueue_list_revalidation_for_universe(new.universe_id, 'games_lists_' || lower(tg_op));
    perform public.enqueue_wiki_revalidation_for_universe(new.universe_id, 'games_wiki_' || lower(tg_op));
  end if;

  if tg_op = 'UPDATE' and old.is_published = true then
    perform public.enqueue_list_revalidation_for_universe(old.universe_id, 'games_lists_update_old');
    perform public.enqueue_wiki_revalidation_for_universe(old.universe_id, 'games_wiki_update_old');

    if old.slug is distinct from new.slug or new.is_published is distinct from true then
      perform public.enqueue_revalidation('code', old.slug, 'games_old_slug_or_unpublish');
    end if;
  end if;

  return null;
end;
$$;


ALTER FUNCTION "public"."trg_enqueue_revalidation_games"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."trg_enqueue_revalidation_lists_roblox_universe"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
begin
  perform public.enqueue_list_revalidation_for_universe(new.universe_id, 'roblox_universes_lists_update');
  return null;
end;
$$;


ALTER FUNCTION "public"."trg_enqueue_revalidation_lists_roblox_universe"() OWNER TO "postgres";


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


CREATE OR REPLACE FUNCTION "public"."trg_enqueue_revalidation_wiki_catalog_pages"() RETURNS "trigger"
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
      perform public.enqueue_revalidation('wiki_catalog', old_slug, 'wiki_catalog_pages_delete');
      perform public.enqueue_revalidation('wiki', old.wiki_slug, 'wiki_catalog_pages_wiki_delete');
    end if;
    return null;
  end if;

  if new.is_published = true then
    new_slug := new.wiki_slug || '/' || new.collection_slug;
    perform public.enqueue_revalidation('wiki_catalog', new_slug, 'wiki_catalog_pages_' || lower(tg_op));
    perform public.enqueue_revalidation('wiki', new.wiki_slug, 'wiki_catalog_pages_wiki_' || lower(tg_op));
  end if;

  if tg_op = 'UPDATE' and old.is_published = true then
    perform public.enqueue_revalidation('wiki', old.wiki_slug, 'wiki_catalog_pages_wiki_update_old');

    if old.wiki_slug is distinct from new.wiki_slug
      or old.collection_slug is distinct from new.collection_slug
      or new.is_published is distinct from true then
      old_slug := old.wiki_slug || '/' || old.collection_slug;
      perform public.enqueue_revalidation('wiki_catalog', old_slug, 'wiki_catalog_pages_old_slug_or_unpublish');
    end if;
  end if;

  return null;
end;
$$;


ALTER FUNCTION "public"."trg_enqueue_revalidation_wiki_catalog_pages"() OWNER TO "postgres";


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


CREATE OR REPLACE FUNCTION "public"."trg_search_index_game_lists"() RETURNS "trigger"
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


ALTER FUNCTION "public"."trg_search_index_game_lists"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."trg_search_index_games"() RETURNS "trigger"
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


ALTER FUNCTION "public"."trg_search_index_games"() OWNER TO "postgres";


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


CREATE OR REPLACE FUNCTION "public"."trg_search_index_wiki_catalog_pages"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'pg_catalog', 'public'
    AS $$
declare
  v_search text;
  v_slug text;
begin
  if (tg_op = 'DELETE') then
    delete from public.search_index
    where entity_type = 'wiki_catalog'
      and entity_id = old.id::text;
    return null;
  end if;

  v_slug := new.wiki_slug || '/' || new.collection_slug;
  v_search := left(
    concat_ws(
      ' ',
      new.title,
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
    'wiki_catalog',
    new.id::text,
    v_slug,
    new.title,
    'Wiki catalog',
    '/wiki/' || v_slug,
    new.updated_at,
    new.is_published,
    v_search
  );

  return null;
end;
$$;


ALTER FUNCTION "public"."trg_search_index_wiki_catalog_pages"() OWNER TO "postgres";


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


CREATE OR REPLACE FUNCTION "public"."upsert_code"("p_game_id" "uuid", "p_code" "text", "p_status" "text", "p_rewards_text" "text", "p_level_requirement" integer, "p_is_new" boolean) RETURNS "void"
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


ALTER FUNCTION "public"."upsert_code"("p_game_id" "uuid", "p_code" "text", "p_status" "text", "p_rewards_text" "text", "p_level_requirement" integer, "p_is_new" boolean) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."upsert_code"("p_game_id" "uuid", "p_code" "text", "p_status" "text", "p_rewards_text" "text", "p_level_requirement" integer, "p_is_new" boolean, "p_provider_priority" integer DEFAULT 0) RETURNS "void"
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


ALTER FUNCTION "public"."upsert_code"("p_game_id" "uuid", "p_code" "text", "p_status" "text", "p_rewards_text" "text", "p_level_requirement" integer, "p_is_new" boolean, "p_provider_priority" integer) OWNER TO "postgres";


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
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."app_sessions" OWNER TO "postgres";


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
    "discovery_score" numeric,
    "quality_score" numeric,
    "quality_tier" "text",
    "quality_reasons" "jsonb" DEFAULT '[]'::"jsonb" NOT NULL,
    "last_quality_scored_at" timestamp with time zone,
    "last_light_enriched_at" timestamp with time zone,
    "last_deep_enriched_at" timestamp with time zone,
    "last_stats_refreshed_at" timestamp with time zone,
    "last_playing_refreshed_at" timestamp with time zone,
    "discovery_sources" "jsonb" DEFAULT '[]'::"jsonb" NOT NULL,
    "is_quality_candidate" boolean,
    CONSTRAINT "roblox_universes_quality_tier_check" CHECK ((("quality_tier" IS NULL) OR ("quality_tier" = ANY (ARRAY['A'::"text", 'B'::"text", 'C'::"text", 'D'::"text", 'archive'::"text"]))))
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


ALTER VIEW "public"."article_pages_view" OWNER TO "postgres";


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


CREATE TABLE IF NOT EXISTS "public"."codes" (
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


ALTER TABLE "public"."codes" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."games" (
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


ALTER TABLE "public"."games" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."code_pages_view" WITH ("security_invoker"='true') AS
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
   FROM (("public"."games" "g"
     LEFT JOIN "code_stats" "cs" ON (("cs"."game_id" = "g"."id")))
     LEFT JOIN "public"."roblox_universes" "u" ON (("u"."universe_id" = "g"."universe_id")));


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
    CONSTRAINT "comments_entity_type_check" CHECK (("entity_type" = ANY (ARRAY['code'::"text", 'article'::"text", 'catalog'::"text", 'event'::"text", 'list'::"text", 'tool'::"text"]))),
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


CREATE OR REPLACE VIEW "public"."game_code_stats" WITH ("security_invoker"='true') AS
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


ALTER VIEW "public"."game_code_stats" OWNER TO "postgres";


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


CREATE TABLE IF NOT EXISTS "public"."game_list_entries" (
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


ALTER TABLE "public"."game_list_entries" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."game_lists" (
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


ALTER TABLE "public"."game_lists" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."game_lists_index_view" WITH ("security_invoker"='true') AS
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


ALTER VIEW "public"."game_lists_index_view" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."game_lists_view" AS
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


ALTER VIEW "public"."game_lists_view" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."game_pages_index_view" WITH ("security_invoker"='true') AS
 SELECT "g"."id",
    "g"."slug",
    "g"."name",
    "g"."is_published",
    "g"."cover_image",
    "g"."updated_at",
    "g"."created_at",
    "g"."universe_id",
    "g"."internal_links",
    COALESCE("cs"."active_code_count", (0)::bigint) AS "active_code_count",
    "cs"."latest_code_first_seen_at",
    GREATEST(COALESCE("cs"."latest_code_first_seen_at", "g"."updated_at"), "g"."updated_at") AS "content_updated_at",
    "u"."genre_l1",
    "u"."genre_l2"
   FROM (("public"."games" "g"
     LEFT JOIN ( SELECT "codes"."game_id",
            "count"(*) FILTER (WHERE ("codes"."status" = 'active'::"text")) AS "active_code_count",
            "max"("codes"."first_seen_at") FILTER (WHERE ("codes"."status" = 'active'::"text")) AS "latest_code_first_seen_at"
           FROM "public"."codes"
          GROUP BY "codes"."game_id") "cs" ON (("cs"."game_id" = "g"."id")))
     LEFT JOIN "public"."roblox_universes" "u" ON (("u"."universe_id" = "g"."universe_id")))
  WHERE ("g"."is_published" IS NOT NULL);


ALTER VIEW "public"."game_pages_index_view" OWNER TO "postgres";


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
    CONSTRAINT "roblox_catalog_items_demand_consistency_check" CHECK ((("demand_consistency" >= 0) AND ("demand_consistency" <= 100))),
    CONSTRAINT "roblox_catalog_items_demand_level_check" CHECK (("demand_level" = ANY (ARRAY['amazing'::"text", 'popular'::"text", 'normal'::"text", 'terrible'::"text"]))),
    CONSTRAINT "roblox_catalog_items_demand_score_check" CHECK ((("demand_score" >= 0) AND ("demand_score" <= 100))),
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


CREATE OR REPLACE VIEW "public"."puzzle_pages_view" AS
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
    CONSTRAINT "revalidation_events_entity_type_check" CHECK (("entity_type" = ANY (ARRAY['code'::"text", 'article'::"text", 'list'::"text", 'author'::"text", 'event'::"text", 'checklist'::"text", 'tool'::"text", 'catalog'::"text", 'music'::"text", 'quiz'::"text", 'wiki'::"text", 'wiki_catalog'::"text", 'stats'::"text", 'puzzle'::"text"])))
);


ALTER TABLE "public"."revalidation_events" OWNER TO "postgres";


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


CREATE TABLE IF NOT EXISTS "public"."roblox_universe_discovery_jobs" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "job_key" "text" NOT NULL,
    "source" "text" NOT NULL,
    "strategy" "text" NOT NULL,
    "query" "text",
    "params" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "status" "text" DEFAULT 'pending'::"text" NOT NULL,
    "priority" integer DEFAULT 0 NOT NULL,
    "attempts" integer DEFAULT 0 NOT NULL,
    "max_attempts" integer DEFAULT 5 NOT NULL,
    "result_count" integer DEFAULT 0 NOT NULL,
    "new_universe_count" integer DEFAULT 0 NOT NULL,
    "cursor" "text",
    "cooldown_until" timestamp with time zone,
    "next_run_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "locked_at" timestamp with time zone,
    "locked_by" "text",
    "last_error" "text",
    "last_run_at" timestamp with time zone,
    "completed_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "roblox_universe_discovery_jobs_status_check" CHECK (("status" = ANY (ARRAY['pending'::"text", 'in_progress'::"text", 'completed'::"text", 'failed'::"text", 'paused'::"text"])))
);


ALTER TABLE "public"."roblox_universe_discovery_jobs" OWNER TO "postgres";


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


CREATE TABLE IF NOT EXISTS "public"."roblox_universe_search_snapshots" (
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


ALTER TABLE "public"."roblox_universe_search_snapshots" OWNER TO "postgres";


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


CREATE TABLE IF NOT EXISTS "public"."roblox_universe_sort_definitions" (
    "sort_id" "text" NOT NULL,
    "title" "text",
    "description" "text",
    "layout" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "experiments" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "last_seen_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."roblox_universe_sort_definitions" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."roblox_universe_sort_entries" (
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


ALTER TABLE "public"."roblox_universe_sort_entries" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."roblox_universe_sort_runs" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "session_id" "uuid" NOT NULL,
    "device" "text" NOT NULL,
    "country" "text" NOT NULL,
    "retrieved_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."roblox_universe_sort_runs" OWNER TO "postgres";


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


CREATE TABLE IF NOT EXISTS "public"."wiki_catalog_pages" (
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
    CONSTRAINT "wiki_catalog_pages_code_not_blank" CHECK (("length"("btrim"("code")) > 0)),
    CONSTRAINT "wiki_catalog_pages_collection_slug_not_blank" CHECK (("length"("btrim"("collection_slug")) > 0)),
    CONSTRAINT "wiki_catalog_pages_wiki_slug_not_blank" CHECK (("length"("btrim"("wiki_slug")) > 0))
);


ALTER TABLE "public"."wiki_catalog_pages" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."wiki_catalog_pages_view" WITH ("security_invoker"='true') AS
 SELECT "id",
    "wiki_page_id",
    "universe_id",
    "wiki_slug",
    "collection_slug",
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
    "wiki_md",
    "wiki_sort_order",
    "is_published",
    "published_at",
    "created_at",
    "updated_at",
    GREATEST("updated_at", COALESCE("published_at", "updated_at")) AS "content_updated_at"
   FROM "public"."wiki_catalog_pages" "wcp";


ALTER VIEW "public"."wiki_catalog_pages_view" OWNER TO "postgres";


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



ALTER TABLE ONLY "public"."codes"
    ADD CONSTRAINT "codes_game_id_code_key" UNIQUE ("game_id", "code");



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



ALTER TABLE ONLY "public"."game_list_entries"
    ADD CONSTRAINT "game_list_entries_pkey" PRIMARY KEY ("list_id", "universe_id");



ALTER TABLE ONLY "public"."game_lists"
    ADD CONSTRAINT "game_lists_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."game_lists"
    ADD CONSTRAINT "game_lists_slug_key" UNIQUE ("slug");



ALTER TABLE ONLY "public"."games"
    ADD CONSTRAINT "games_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."games"
    ADD CONSTRAINT "games_slug_key" UNIQUE ("slug");



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



ALTER TABLE ONLY "public"."roblox_catalog_categories"
    ADD CONSTRAINT "roblox_catalog_categories_pkey" PRIMARY KEY ("category");



ALTER TABLE ONLY "public"."roblox_catalog_discovery_hits"
    ADD CONSTRAINT "roblox_catalog_discovery_hits_pkey" PRIMARY KEY ("run_id", "asset_id");



ALTER TABLE ONLY "public"."roblox_catalog_discovery_runs"
    ADD CONSTRAINT "roblox_catalog_discovery_runs_pkey" PRIMARY KEY ("run_id");



ALTER TABLE ONLY "public"."roblox_catalog_item_images"
    ADD CONSTRAINT "roblox_catalog_item_images_pkey" PRIMARY KEY ("asset_id", "size", "format");



ALTER TABLE ONLY "public"."roblox_catalog_items_history"
    ADD CONSTRAINT "roblox_catalog_items_history_pkey" PRIMARY KEY ("asset_id", "recorded_at");



ALTER TABLE ONLY "public"."roblox_catalog_items"
    ADD CONSTRAINT "roblox_catalog_items_pkey" PRIMARY KEY ("asset_id");



ALTER TABLE ONLY "public"."roblox_catalog_refresh_queue"
    ADD CONSTRAINT "roblox_catalog_refresh_queue_pkey" PRIMARY KEY ("asset_id");



ALTER TABLE ONLY "public"."roblox_catalog_subcategories"
    ADD CONSTRAINT "roblox_catalog_subcategories_pkey" PRIMARY KEY ("subcategory");



ALTER TABLE ONLY "public"."roblox_groups"
    ADD CONSTRAINT "roblox_groups_pkey" PRIMARY KEY ("group_id");



ALTER TABLE ONLY "public"."roblox_music_ids"
    ADD CONSTRAINT "roblox_music_ids_pkey" PRIMARY KEY ("asset_id");



ALTER TABLE ONLY "public"."roblox_universe_badges"
    ADD CONSTRAINT "roblox_universe_badges_pkey" PRIMARY KEY ("badge_id");



ALTER TABLE ONLY "public"."roblox_universe_discovery_jobs"
    ADD CONSTRAINT "roblox_universe_discovery_jobs_job_key_key" UNIQUE ("job_key");



ALTER TABLE ONLY "public"."roblox_universe_discovery_jobs"
    ADD CONSTRAINT "roblox_universe_discovery_jobs_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."roblox_universe_gamepasses"
    ADD CONSTRAINT "roblox_universe_gamepasses_pkey" PRIMARY KEY ("pass_id");



ALTER TABLE ONLY "public"."roblox_universe_media"
    ADD CONSTRAINT "roblox_universe_media_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."roblox_universe_place_servers"
    ADD CONSTRAINT "roblox_universe_place_servers_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."roblox_universe_place_servers"
    ADD CONSTRAINT "roblox_universe_place_servers_place_id_server_id_fetched_at_key" UNIQUE ("place_id", "server_id", "fetched_at");



ALTER TABLE ONLY "public"."roblox_universe_rank_snapshots"
    ADD CONSTRAINT "roblox_universe_rank_snapshots_pkey" PRIMARY KEY ("universe_id", "rank_type", "sampled_at");



ALTER TABLE ONLY "public"."roblox_universe_search_snapshots"
    ADD CONSTRAINT "roblox_universe_search_snapshots_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."roblox_universe_social_links"
    ADD CONSTRAINT "roblox_universe_social_links_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."roblox_universe_social_links"
    ADD CONSTRAINT "roblox_universe_social_links_universe_id_platform_url_key" UNIQUE ("universe_id", "platform", "url");



ALTER TABLE ONLY "public"."roblox_universe_sort_definitions"
    ADD CONSTRAINT "roblox_universe_sort_definitions_pkey" PRIMARY KEY ("sort_id");



ALTER TABLE ONLY "public"."roblox_universe_sort_entries"
    ADD CONSTRAINT "roblox_universe_sort_entries_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."roblox_universe_sort_entries"
    ADD CONSTRAINT "roblox_universe_sort_entries_sort_id_universe_id_session_id_key" UNIQUE ("sort_id", "universe_id", "session_id", "fetched_at");



ALTER TABLE ONLY "public"."roblox_universe_sort_runs"
    ADD CONSTRAINT "roblox_universe_sort_runs_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."roblox_universe_stats_daily"
    ADD CONSTRAINT "roblox_universe_stats_daily_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."roblox_universe_stats_daily"
    ADD CONSTRAINT "roblox_universe_stats_daily_universe_id_stat_date_key" UNIQUE ("universe_id", "stat_date");



ALTER TABLE ONLY "public"."roblox_universe_stats_hourly"
    ADD CONSTRAINT "roblox_universe_stats_hourly_pkey" PRIMARY KEY ("universe_id", "hour_start");



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



ALTER TABLE ONLY "public"."wiki_catalog_pages"
    ADD CONSTRAINT "wiki_catalog_pages_code_key" UNIQUE ("code");



ALTER TABLE ONLY "public"."wiki_catalog_pages"
    ADD CONSTRAINT "wiki_catalog_pages_path_key" UNIQUE ("wiki_slug", "collection_slug");



ALTER TABLE ONLY "public"."wiki_catalog_pages"
    ADD CONSTRAINT "wiki_catalog_pages_pkey" PRIMARY KEY ("id");



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



CREATE INDEX "idx_catalog_pages_is_published" ON "public"."catalog_pages" USING "btree" ("is_published");



CREATE INDEX "idx_catalog_pages_universe_id" ON "public"."catalog_pages" USING "btree" ("universe_id");



CREATE INDEX "idx_catalog_pages_universe_wiki_sort" ON "public"."catalog_pages" USING "btree" ("universe_id", "wiki_sort_order") WHERE ("is_published" = true);



CREATE INDEX "idx_checklist_items_page" ON "public"."checklist_items" USING "btree" ("page_id");



CREATE INDEX "idx_checklist_items_page_section" ON "public"."checklist_items" USING "btree" ("page_id", "section_code");



CREATE INDEX "idx_checklist_pages_published" ON "public"."checklist_pages" USING "btree" ("is_public", "published_at" DESC NULLS LAST, "updated_at" DESC);



CREATE INDEX "idx_checklist_pages_universe_slug" ON "public"."checklist_pages" USING "btree" ("universe_id", "lower"("slug"));



CREATE UNIQUE INDEX "idx_codes_game_code_upper" ON "public"."codes" USING "btree" ("game_id", "upper"("code"));



CREATE INDEX "idx_codes_game_first_seen" ON "public"."codes" USING "btree" ("game_id", "first_seen_at" DESC);



CREATE INDEX "idx_codes_game_status_seen" ON "public"."codes" USING "btree" ("game_id", "status", "last_seen_at" DESC);



CREATE INDEX "idx_codes_status_game" ON "public"."codes" USING "btree" ("status", "game_id");



CREATE INDEX "idx_comments_author" ON "public"."comments" USING "btree" ("author_id");



CREATE INDEX "idx_comments_entity_created" ON "public"."comments" USING "btree" ("entity_type", "entity_id", "created_at" DESC);



CREATE INDEX "idx_comments_parent" ON "public"."comments" USING "btree" ("parent_id");



CREATE UNIQUE INDEX "idx_event_guide_generation_queue_event_id" ON "public"."event_guide_generation_queue" USING "btree" ("event_id");



CREATE INDEX "idx_event_guide_generation_queue_status_created" ON "public"."event_guide_generation_queue" USING "btree" ("status", "created_at");



CREATE INDEX "idx_events_pages_is_published" ON "public"."events_pages" USING "btree" ("is_published");



CREATE UNIQUE INDEX "idx_events_pages_slug" ON "public"."events_pages" USING "btree" ("slug");



CREATE INDEX "idx_game_generation_queue_status_created" ON "public"."game_generation_queue" USING "btree" ("status", "created_at");



CREATE INDEX "idx_game_list_entries_game" ON "public"."game_list_entries" USING "btree" ("game_id");



CREATE INDEX "idx_game_list_entries_rank" ON "public"."game_list_entries" USING "btree" ("list_id", "rank");



CREATE INDEX "idx_game_list_entries_universe" ON "public"."game_list_entries" USING "btree" ("universe_id");



CREATE INDEX "idx_game_lists_published" ON "public"."game_lists" USING "btree" ("is_published", "updated_at" DESC);



CREATE INDEX "idx_game_lists_slug" ON "public"."game_lists" USING "btree" ("lower"("slug"));



CREATE INDEX "idx_games_old_slugs" ON "public"."games" USING "gin" ("old_slugs");



CREATE INDEX "idx_games_published" ON "public"."games" USING "btree" ("is_published");



CREATE INDEX "idx_games_published_name" ON "public"."games" USING "btree" ("is_published", "name");



CREATE INDEX "idx_games_published_updated" ON "public"."games" USING "btree" ("is_published", "updated_at" DESC);



CREATE INDEX "idx_games_slug" ON "public"."games" USING "btree" ("lower"("slug"));



CREATE INDEX "idx_games_universe_id" ON "public"."games" USING "btree" ("universe_id");



CREATE INDEX "idx_google_indexing_attempts_submitted_at" ON "public"."google_indexing_attempts" USING "btree" ("submitted_at" DESC);



CREATE INDEX "idx_google_indexing_attempts_type_submitted_at" ON "public"."google_indexing_attempts" USING "btree" ("notification_type", "submitted_at" DESC);



CREATE INDEX "idx_google_indexing_attempts_url" ON "public"."google_indexing_attempts" USING "btree" ("url");



CREATE INDEX "idx_google_indexing_url_state_last_submitted_at" ON "public"."google_indexing_url_state" USING "btree" ("notification_type", "last_submitted_at" NULLS FIRST);



CREATE INDEX "idx_puzzle_answers_fetched_at" ON "public"."puzzle_answers" USING "btree" ("fetched_at" DESC);



CREATE INDEX "idx_puzzle_answers_slug_date" ON "public"."puzzle_answers" USING "btree" ("puzzle_slug", "answer_date" DESC);



CREATE INDEX "idx_puzzle_pages_published_sort" ON "public"."puzzle_pages" USING "btree" ("is_published", "sort_order", "title");



CREATE INDEX "idx_puzzle_sync_runs_slug_ran_at" ON "public"."puzzle_sync_runs" USING "btree" ("puzzle_slug", "ran_at" DESC);



CREATE INDEX "idx_puzzle_sync_runs_status_ran_at" ON "public"."puzzle_sync_runs" USING "btree" ("status", "ran_at" DESC);



CREATE INDEX "idx_quiz_pages_is_published" ON "public"."quiz_pages" USING "btree" ("is_published", "published_at" DESC NULLS LAST, "updated_at" DESC);



CREATE INDEX "idx_quiz_pages_universe_id" ON "public"."quiz_pages" USING "btree" ("universe_id");



CREATE INDEX "idx_revalidation_events_created" ON "public"."revalidation_events" USING "btree" ("created_at" DESC);



CREATE INDEX "idx_revalidation_events_type_slug" ON "public"."revalidation_events" USING "btree" ("entity_type", "slug");



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



CREATE INDEX "idx_roblox_catalog_items_subcategory" ON "public"."roblox_catalog_items" USING "btree" ("subcategory");



CREATE INDEX "idx_roblox_catalog_items_trading_value" ON "public"."roblox_catalog_items" USING "btree" ("trading_value" DESC NULLS LAST) WHERE (("is_limited" = true) OR ("is_limited_unique" = true));



CREATE INDEX "idx_roblox_catalog_items_trend_direction" ON "public"."roblox_catalog_items" USING "btree" ("trend_direction", "trading_value" DESC NULLS LAST) WHERE (("is_limited" = true) OR ("is_limited_unique" = true));



CREATE INDEX "idx_roblox_catalog_refresh_queue_next_run_at" ON "public"."roblox_catalog_refresh_queue" USING "btree" ("next_run_at");



CREATE INDEX "idx_roblox_catalog_refresh_queue_priority" ON "public"."roblox_catalog_refresh_queue" USING "btree" ("priority");



CREATE INDEX "idx_roblox_catalog_subcategories_category" ON "public"."roblox_catalog_subcategories" USING "btree" ("category");



CREATE INDEX "idx_roblox_music_ids_boombox_ready" ON "public"."roblox_music_ids" USING "btree" ("boombox_ready");



CREATE INDEX "idx_roblox_music_ids_last_seen" ON "public"."roblox_music_ids" USING "btree" ("last_seen_at" DESC);



CREATE INDEX "idx_roblox_music_ids_popularity_score" ON "public"."roblox_music_ids" USING "btree" ("popularity_score" DESC);



CREATE INDEX "idx_roblox_music_ids_rank" ON "public"."roblox_music_ids" USING "btree" ("rank");



CREATE INDEX "idx_roblox_music_ids_verified_at" ON "public"."roblox_music_ids" USING "btree" ("verified_at");



CREATE INDEX "idx_roblox_universe_badges" ON "public"."roblox_universe_badges" USING "btree" ("universe_id");



CREATE INDEX "idx_roblox_universe_discovery_jobs_query" ON "public"."roblox_universe_discovery_jobs" USING "btree" ("source", "strategy", "query");



CREATE INDEX "idx_roblox_universe_discovery_jobs_ready" ON "public"."roblox_universe_discovery_jobs" USING "btree" ("status", "next_run_at", "priority" DESC) WHERE ("status" = ANY (ARRAY['pending'::"text", 'failed'::"text"]));



CREATE INDEX "idx_roblox_universe_gamepasses" ON "public"."roblox_universe_gamepasses" USING "btree" ("universe_id");



CREATE INDEX "idx_roblox_universe_media_universe" ON "public"."roblox_universe_media" USING "btree" ("universe_id", "media_type");



CREATE INDEX "idx_roblox_universe_place_servers_place" ON "public"."roblox_universe_place_servers" USING "btree" ("place_id", "fetched_at" DESC);



CREATE INDEX "idx_roblox_universe_place_servers_universe" ON "public"."roblox_universe_place_servers" USING "btree" ("universe_id", "fetched_at" DESC);



CREATE INDEX "idx_roblox_universe_rank_snapshots_type_time" ON "public"."roblox_universe_rank_snapshots" USING "btree" ("rank_type", "sampled_at" DESC, "rank_value");



CREATE INDEX "idx_roblox_universe_rank_snapshots_universe" ON "public"."roblox_universe_rank_snapshots" USING "btree" ("universe_id", "sampled_at" DESC);



CREATE INDEX "idx_roblox_universe_search_snapshots_query" ON "public"."roblox_universe_search_snapshots" USING "btree" ("query", "fetched_at" DESC);



CREATE INDEX "idx_roblox_universe_search_snapshots_universe" ON "public"."roblox_universe_search_snapshots" USING "btree" ("universe_id", "fetched_at" DESC);



CREATE INDEX "idx_roblox_universe_sort_entries_sort" ON "public"."roblox_universe_sort_entries" USING "btree" ("sort_id", "fetched_at" DESC);



CREATE INDEX "idx_roblox_universe_sort_entries_universe" ON "public"."roblox_universe_sort_entries" USING "btree" ("universe_id", "fetched_at" DESC);



CREATE INDEX "idx_roblox_universe_stats_daily" ON "public"."roblox_universe_stats_daily" USING "btree" ("universe_id", "stat_date" DESC);



CREATE INDEX "idx_roblox_universe_stats_hourly_hour" ON "public"."roblox_universe_stats_hourly" USING "btree" ("hour_start" DESC);



CREATE INDEX "idx_roblox_universe_stats_hourly_peak_playing" ON "public"."roblox_universe_stats_hourly" USING "btree" ("peak_playing" DESC, "hour_start" DESC);



CREATE INDEX "idx_roblox_universe_stats_hourly_playing" ON "public"."roblox_universe_stats_hourly" USING "btree" ("playing" DESC, "hour_start" DESC);



CREATE INDEX "idx_roblox_universe_stats_hourly_universe_hour" ON "public"."roblox_universe_stats_hourly" USING "btree" ("universe_id", "hour_start" DESC);



CREATE INDEX "idx_roblox_universes_creator" ON "public"."roblox_universes" USING "btree" ("creator_id");



CREATE INDEX "idx_roblox_universes_deep_enriched" ON "public"."roblox_universes" USING "btree" ("last_deep_enriched_at" NULLS FIRST, "quality_score" DESC NULLS LAST);



CREATE INDEX "idx_roblox_universes_light_enriched" ON "public"."roblox_universes" USING "btree" ("last_light_enriched_at" NULLS FIRST, "last_seen_in_search" DESC NULLS LAST);



CREATE INDEX "idx_roblox_universes_quality" ON "public"."roblox_universes" USING "btree" ("quality_tier", "quality_score" DESC NULLS LAST);



CREATE INDEX "idx_roblox_universes_seen" ON "public"."roblox_universes" USING "btree" (COALESCE("last_seen_in_sort", "last_seen_in_search") DESC);



CREATE INDEX "idx_roblox_universes_slug" ON "public"."roblox_universes" USING "btree" ("lower"("slug"));



CREATE INDEX "idx_roblox_virtual_events_event_status" ON "public"."roblox_virtual_events" USING "btree" ("event_status");



CREATE INDEX "idx_roblox_virtual_events_first_live_at" ON "public"."roblox_virtual_events" USING "btree" ("first_live_at");



CREATE INDEX "idx_roblox_virtual_events_start_utc" ON "public"."roblox_virtual_events" USING "btree" ("start_utc");



CREATE INDEX "idx_roblox_virtual_events_universe_id" ON "public"."roblox_virtual_events" USING "btree" ("universe_id");



CREATE UNIQUE INDEX "idx_search_index_entity" ON "public"."search_index" USING "btree" ("entity_type", "entity_id");



CREATE INDEX "idx_search_index_published_updated" ON "public"."search_index" USING "btree" ("is_published", "updated_at" DESC);



CREATE INDEX "idx_search_index_search_text_trgm" ON "public"."search_index" USING "gin" ("search_text" "extensions"."gin_trgm_ops");



CREATE INDEX "idx_search_index_type_slug" ON "public"."search_index" USING "btree" ("entity_type", "slug");



CREATE INDEX "idx_search_index_vector" ON "public"."search_index" USING "gin" ("search_vector");



CREATE INDEX "idx_tools_is_published" ON "public"."tools" USING "btree" ("is_published");



CREATE INDEX "idx_user_checklist_progress_slug" ON "public"."user_checklist_progress" USING "btree" ("checklist_slug");



CREATE INDEX "idx_user_code_progress_slug" ON "public"."user_code_progress" USING "btree" ("game_slug");



CREATE INDEX "idx_user_quiz_progress_code" ON "public"."user_quiz_progress" USING "btree" ("quiz_code");



CREATE INDEX "idx_wiki_catalog_pages_is_published" ON "public"."wiki_catalog_pages" USING "btree" ("is_published");



CREATE INDEX "idx_wiki_catalog_pages_universe_id" ON "public"."wiki_catalog_pages" USING "btree" ("universe_id");



CREATE INDEX "idx_wiki_catalog_pages_wiki_sort" ON "public"."wiki_catalog_pages" USING "btree" ("wiki_slug", "wiki_sort_order") WHERE ("is_published" = true);



CREATE INDEX "idx_wiki_pages_published" ON "public"."wiki_pages" USING "btree" ("is_published", "published_at" DESC NULLS LAST, "updated_at" DESC);



CREATE UNIQUE INDEX "idx_wiki_pages_slug_lower" ON "public"."wiki_pages" USING "btree" ("lower"("slug"));



CREATE INDEX "idx_wiki_pages_universe_id" ON "public"."wiki_pages" USING "btree" ("universe_id");



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



CREATE OR REPLACE TRIGGER "trg_app_sessions_updated_at" BEFORE UPDATE ON "public"."app_sessions" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "trg_app_users_updated_at" BEFORE UPDATE ON "public"."app_users" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "trg_article_generation_artifacts_updated_at" BEFORE UPDATE ON "public"."article_generation_artifacts" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "trg_article_generation_queue_idempotency_key" BEFORE INSERT OR UPDATE OF "article_title", "universe_id" ON "public"."article_generation_queue" FOR EACH ROW EXECUTE FUNCTION "public"."set_article_generation_queue_idempotency_key"();



CREATE OR REPLACE TRIGGER "trg_article_generation_queue_updated_at" BEFORE UPDATE ON "public"."article_generation_queue" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "trg_articles_updated_at" BEFORE UPDATE ON "public"."articles" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "trg_authors_updated_at" BEFORE UPDATE ON "public"."authors" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "trg_catalog_pages_updated_at" BEFORE UPDATE ON "public"."catalog_pages" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "trg_checklist_items_normalize" BEFORE INSERT OR UPDATE ON "public"."checklist_items" FOR EACH ROW EXECUTE FUNCTION "public"."trg_normalize_section_code"();



CREATE OR REPLACE TRIGGER "trg_checklist_items_updated_at" BEFORE UPDATE ON "public"."checklist_items" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "trg_checklist_pages_updated_at" BEFORE UPDATE ON "public"."checklist_pages" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "trg_comments_revalidate_entity" AFTER INSERT OR DELETE OR UPDATE ON "public"."comments" FOR EACH ROW EXECUTE FUNCTION "public"."trg_comments_revalidate_entity"();



CREATE OR REPLACE TRIGGER "trg_comments_updated_at" BEFORE UPDATE ON "public"."comments" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "trg_enqueue_revalidation_articles" AFTER INSERT OR DELETE OR UPDATE ON "public"."articles" FOR EACH ROW EXECUTE FUNCTION "public"."trg_enqueue_revalidation_articles"();



CREATE OR REPLACE TRIGGER "trg_enqueue_revalidation_avatar_catalog_images" AFTER INSERT OR DELETE OR UPDATE ON "public"."roblox_catalog_item_images" FOR EACH ROW EXECUTE FUNCTION "public"."trg_enqueue_revalidation_avatar_catalog_images"();



CREATE OR REPLACE TRIGGER "trg_enqueue_revalidation_avatar_catalog_items" AFTER INSERT OR DELETE OR UPDATE ON "public"."roblox_catalog_items" FOR EACH ROW EXECUTE FUNCTION "public"."trg_enqueue_revalidation_avatar_catalog_items"();



CREATE OR REPLACE TRIGGER "trg_enqueue_revalidation_catalog_pages" AFTER INSERT OR DELETE OR UPDATE ON "public"."catalog_pages" FOR EACH ROW EXECUTE FUNCTION "public"."trg_enqueue_revalidation_catalog_pages"();



CREATE OR REPLACE TRIGGER "trg_enqueue_revalidation_checklist_items" AFTER INSERT OR DELETE OR UPDATE ON "public"."checklist_items" FOR EACH ROW EXECUTE FUNCTION "public"."trg_enqueue_revalidation_checklist_items"();



CREATE OR REPLACE TRIGGER "trg_enqueue_revalidation_checklist_pages" AFTER INSERT OR DELETE OR UPDATE ON "public"."checklist_pages" FOR EACH ROW EXECUTE FUNCTION "public"."trg_enqueue_revalidation_checklist_pages"();



CREATE OR REPLACE TRIGGER "trg_enqueue_revalidation_codes" AFTER INSERT OR DELETE OR UPDATE ON "public"."codes" FOR EACH ROW EXECUTE FUNCTION "public"."trg_enqueue_revalidation_codes"();



CREATE OR REPLACE TRIGGER "trg_enqueue_revalidation_events_pages" AFTER INSERT OR DELETE OR UPDATE ON "public"."events_pages" FOR EACH ROW EXECUTE FUNCTION "public"."trg_enqueue_revalidation_events_pages"();



CREATE OR REPLACE TRIGGER "trg_enqueue_revalidation_free_item_images" AFTER INSERT OR DELETE OR UPDATE ON "public"."roblox_catalog_item_images" FOR EACH ROW EXECUTE FUNCTION "public"."trg_enqueue_revalidation_free_item_images"();



CREATE OR REPLACE TRIGGER "trg_enqueue_revalidation_free_items_catalog" AFTER INSERT OR DELETE OR UPDATE ON "public"."roblox_catalog_items" FOR EACH ROW EXECUTE FUNCTION "public"."trg_enqueue_revalidation_free_items_catalog"();



CREATE OR REPLACE TRIGGER "trg_enqueue_revalidation_game_list_entries" AFTER INSERT OR DELETE OR UPDATE ON "public"."game_list_entries" FOR EACH ROW EXECUTE FUNCTION "public"."trg_enqueue_revalidation_game_list_entries"();



CREATE OR REPLACE TRIGGER "trg_enqueue_revalidation_game_lists" AFTER INSERT OR DELETE OR UPDATE ON "public"."game_lists" FOR EACH ROW EXECUTE FUNCTION "public"."trg_enqueue_revalidation_game_lists"();



CREATE OR REPLACE TRIGGER "trg_enqueue_revalidation_games" AFTER INSERT OR DELETE OR UPDATE ON "public"."games" FOR EACH ROW EXECUTE FUNCTION "public"."trg_enqueue_revalidation_games"();



CREATE OR REPLACE TRIGGER "trg_enqueue_revalidation_lists_roblox_universes" AFTER UPDATE OF "root_place_id", "name", "display_name", "slug", "description", "game_description_md", "age_rating", "desktop_enabled", "mobile_enabled", "tablet_enabled", "console_enabled", "vr_enabled", "playing", "visits", "favorites", "likes", "dislikes", "icon_url", "updated_at", "updated_at_api" ON "public"."roblox_universes" FOR EACH ROW EXECUTE FUNCTION "public"."trg_enqueue_revalidation_lists_roblox_universe"();



CREATE OR REPLACE TRIGGER "trg_enqueue_revalidation_music_ids" AFTER INSERT OR DELETE OR UPDATE ON "public"."roblox_music_ids" FOR EACH ROW EXECUTE FUNCTION "public"."trg_enqueue_revalidation_music_ids"();



CREATE OR REPLACE TRIGGER "trg_enqueue_revalidation_puzzle_answers" AFTER INSERT OR DELETE OR UPDATE ON "public"."puzzle_answers" FOR EACH ROW EXECUTE FUNCTION "public"."trg_enqueue_revalidation_puzzle_answers"();



CREATE OR REPLACE TRIGGER "trg_enqueue_revalidation_puzzle_pages" AFTER INSERT OR DELETE OR UPDATE ON "public"."puzzle_pages" FOR EACH ROW EXECUTE FUNCTION "public"."trg_enqueue_revalidation_puzzle_pages"();



CREATE OR REPLACE TRIGGER "trg_enqueue_revalidation_quiz_pages" AFTER INSERT OR DELETE OR UPDATE ON "public"."quiz_pages" FOR EACH ROW EXECUTE FUNCTION "public"."trg_enqueue_revalidation_quiz_pages"();



CREATE OR REPLACE TRIGGER "trg_enqueue_revalidation_tools" AFTER INSERT OR DELETE OR UPDATE ON "public"."tools" FOR EACH ROW EXECUTE FUNCTION "public"."trg_enqueue_revalidation_tools"();



CREATE OR REPLACE TRIGGER "trg_enqueue_revalidation_virtual_event_categories" AFTER INSERT OR DELETE OR UPDATE ON "public"."roblox_virtual_event_categories" FOR EACH ROW EXECUTE FUNCTION "public"."trg_enqueue_revalidation_virtual_event_assets"();



CREATE OR REPLACE TRIGGER "trg_enqueue_revalidation_virtual_event_thumbnails" AFTER INSERT OR DELETE OR UPDATE ON "public"."roblox_virtual_event_thumbnails" FOR EACH ROW EXECUTE FUNCTION "public"."trg_enqueue_revalidation_virtual_event_assets"();



CREATE OR REPLACE TRIGGER "trg_enqueue_revalidation_virtual_events" AFTER INSERT OR DELETE OR UPDATE ON "public"."roblox_virtual_events" FOR EACH ROW EXECUTE FUNCTION "public"."trg_enqueue_revalidation_virtual_events"();



CREATE OR REPLACE TRIGGER "trg_enqueue_revalidation_wiki_catalog_pages" AFTER INSERT OR DELETE OR UPDATE ON "public"."wiki_catalog_pages" FOR EACH ROW EXECUTE FUNCTION "public"."trg_enqueue_revalidation_wiki_catalog_pages"();



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



CREATE OR REPLACE TRIGGER "trg_game_list_entries_updated_at" BEFORE UPDATE ON "public"."game_list_entries" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "trg_game_lists_updated_at" BEFORE UPDATE ON "public"."game_lists" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "trg_games_updated_at" BEFORE UPDATE ON "public"."games" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



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



CREATE OR REPLACE TRIGGER "trg_roblox_music_ids_updated_at" BEFORE UPDATE ON "public"."roblox_music_ids" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "trg_roblox_universe_discovery_jobs_updated_at" BEFORE UPDATE ON "public"."roblox_universe_discovery_jobs" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "trg_roblox_universe_stats_hourly_updated_at" BEFORE UPDATE ON "public"."roblox_universe_stats_hourly" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "trg_roblox_universes_updated_at" BEFORE UPDATE ON "public"."roblox_universes" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "trg_search_index_articles" AFTER INSERT OR DELETE OR UPDATE ON "public"."articles" FOR EACH ROW EXECUTE FUNCTION "public"."trg_search_index_articles"();



CREATE OR REPLACE TRIGGER "trg_search_index_authors" AFTER INSERT OR DELETE OR UPDATE ON "public"."authors" FOR EACH ROW EXECUTE FUNCTION "public"."trg_search_index_authors"();



CREATE OR REPLACE TRIGGER "trg_search_index_catalog_pages" AFTER INSERT OR DELETE OR UPDATE ON "public"."catalog_pages" FOR EACH ROW EXECUTE FUNCTION "public"."trg_search_index_catalog_pages"();



CREATE OR REPLACE TRIGGER "trg_search_index_checklists" AFTER INSERT OR DELETE OR UPDATE ON "public"."checklist_pages" FOR EACH ROW EXECUTE FUNCTION "public"."trg_search_index_checklists"();



CREATE OR REPLACE TRIGGER "trg_search_index_events_pages" AFTER INSERT OR DELETE OR UPDATE ON "public"."events_pages" FOR EACH ROW EXECUTE FUNCTION "public"."trg_search_index_events_pages"();



CREATE OR REPLACE TRIGGER "trg_search_index_game_lists" AFTER INSERT OR DELETE OR UPDATE ON "public"."game_lists" FOR EACH ROW EXECUTE FUNCTION "public"."trg_search_index_game_lists"();



CREATE OR REPLACE TRIGGER "trg_search_index_games" AFTER INSERT OR DELETE OR UPDATE ON "public"."games" FOR EACH ROW EXECUTE FUNCTION "public"."trg_search_index_games"();



CREATE OR REPLACE TRIGGER "trg_search_index_puzzle_pages" AFTER INSERT OR DELETE OR UPDATE ON "public"."puzzle_pages" FOR EACH ROW EXECUTE FUNCTION "public"."trg_search_index_puzzle_pages"();



CREATE OR REPLACE TRIGGER "trg_search_index_quiz_pages" AFTER INSERT OR DELETE OR UPDATE ON "public"."quiz_pages" FOR EACH ROW EXECUTE FUNCTION "public"."trg_search_index_quiz_pages"();



CREATE OR REPLACE TRIGGER "trg_search_index_tools" AFTER INSERT OR DELETE OR UPDATE ON "public"."tools" FOR EACH ROW EXECUTE FUNCTION "public"."trg_search_index_tools"();



CREATE OR REPLACE TRIGGER "trg_search_index_wiki_catalog_pages" AFTER INSERT OR DELETE OR UPDATE ON "public"."wiki_catalog_pages" FOR EACH ROW EXECUTE FUNCTION "public"."trg_search_index_wiki_catalog_pages"();



CREATE OR REPLACE TRIGGER "trg_search_index_wiki_pages" AFTER INSERT OR DELETE OR UPDATE ON "public"."wiki_pages" FOR EACH ROW EXECUTE FUNCTION "public"."trg_search_index_wiki_pages"();



CREATE OR REPLACE TRIGGER "trg_set_article_published_at" BEFORE INSERT OR UPDATE ON "public"."articles" FOR EACH ROW EXECUTE FUNCTION "public"."set_article_published_at"();



CREATE OR REPLACE TRIGGER "trg_set_catalog_page_published_at" BEFORE INSERT OR UPDATE ON "public"."catalog_pages" FOR EACH ROW EXECUTE FUNCTION "public"."set_catalog_page_published_at"();



CREATE OR REPLACE TRIGGER "trg_set_checklist_published_at" BEFORE INSERT OR UPDATE ON "public"."checklist_pages" FOR EACH ROW EXECUTE FUNCTION "public"."set_checklist_published_at"();



CREATE OR REPLACE TRIGGER "trg_set_events_pages_published_at" BEFORE INSERT OR UPDATE ON "public"."events_pages" FOR EACH ROW EXECUTE FUNCTION "public"."set_catalog_page_published_at"();



CREATE OR REPLACE TRIGGER "trg_set_game_published_at" BEFORE INSERT OR UPDATE ON "public"."games" FOR EACH ROW EXECUTE FUNCTION "public"."set_game_published_at"();



CREATE OR REPLACE TRIGGER "trg_set_puzzle_page_published_at" BEFORE INSERT OR UPDATE ON "public"."puzzle_pages" FOR EACH ROW EXECUTE FUNCTION "public"."set_puzzle_page_published_at"();



CREATE OR REPLACE TRIGGER "trg_set_quiz_page_published_at" BEFORE INSERT OR UPDATE ON "public"."quiz_pages" FOR EACH ROW EXECUTE FUNCTION "public"."set_quiz_page_published_at"();



CREATE OR REPLACE TRIGGER "trg_set_tool_published_at" BEFORE INSERT OR UPDATE ON "public"."tools" FOR EACH ROW EXECUTE FUNCTION "public"."set_tool_published_at"();



CREATE OR REPLACE TRIGGER "trg_set_wiki_catalog_page_published_at" BEFORE INSERT OR UPDATE ON "public"."wiki_catalog_pages" FOR EACH ROW EXECUTE FUNCTION "public"."set_catalog_page_published_at"();



CREATE OR REPLACE TRIGGER "trg_set_wiki_page_published_at" BEFORE INSERT OR UPDATE ON "public"."wiki_pages" FOR EACH ROW EXECUTE FUNCTION "public"."set_wiki_page_published_at"();



CREATE OR REPLACE TRIGGER "trg_tools_updated_at" BEFORE UPDATE ON "public"."tools" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "trg_user_checklist_progress_updated_at" BEFORE UPDATE ON "public"."user_checklist_progress" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "trg_user_code_progress_updated_at" BEFORE UPDATE ON "public"."user_code_progress" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "trg_user_quiz_progress_updated_at" BEFORE UPDATE ON "public"."user_quiz_progress" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "trg_wiki_catalog_pages_updated_at" BEFORE UPDATE ON "public"."wiki_catalog_pages" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



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



ALTER TABLE ONLY "public"."codes"
    ADD CONSTRAINT "codes_game_id_fkey" FOREIGN KEY ("game_id") REFERENCES "public"."games"("id") ON DELETE CASCADE;



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



ALTER TABLE ONLY "public"."game_list_entries"
    ADD CONSTRAINT "game_list_entries_game_id_fkey" FOREIGN KEY ("game_id") REFERENCES "public"."games"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."game_list_entries"
    ADD CONSTRAINT "game_list_entries_list_id_fkey" FOREIGN KEY ("list_id") REFERENCES "public"."game_lists"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."game_list_entries"
    ADD CONSTRAINT "game_list_entries_universe_id_fkey" FOREIGN KEY ("universe_id") REFERENCES "public"."roblox_universes"("universe_id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."games"
    ADD CONSTRAINT "games_universe_id_fkey" FOREIGN KEY ("universe_id") REFERENCES "public"."roblox_universes"("universe_id");



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



ALTER TABLE ONLY "public"."roblox_catalog_items_history"
    ADD CONSTRAINT "roblox_catalog_items_history_asset_id_fkey" FOREIGN KEY ("asset_id") REFERENCES "public"."roblox_catalog_items"("asset_id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."roblox_catalog_refresh_queue"
    ADD CONSTRAINT "roblox_catalog_refresh_queue_asset_id_fkey" FOREIGN KEY ("asset_id") REFERENCES "public"."roblox_catalog_items"("asset_id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."roblox_catalog_subcategories"
    ADD CONSTRAINT "roblox_catalog_subcategories_category_fkey" FOREIGN KEY ("category") REFERENCES "public"."roblox_catalog_categories"("category") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."roblox_universe_badges"
    ADD CONSTRAINT "roblox_universe_badges_universe_id_fkey" FOREIGN KEY ("universe_id") REFERENCES "public"."roblox_universes"("universe_id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."roblox_universe_gamepasses"
    ADD CONSTRAINT "roblox_universe_gamepasses_universe_id_fkey" FOREIGN KEY ("universe_id") REFERENCES "public"."roblox_universes"("universe_id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."roblox_universe_media"
    ADD CONSTRAINT "roblox_universe_media_universe_id_fkey" FOREIGN KEY ("universe_id") REFERENCES "public"."roblox_universes"("universe_id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."roblox_universe_place_servers"
    ADD CONSTRAINT "roblox_universe_place_servers_universe_id_fkey" FOREIGN KEY ("universe_id") REFERENCES "public"."roblox_universes"("universe_id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."roblox_universe_rank_snapshots"
    ADD CONSTRAINT "roblox_universe_rank_snapshots_universe_id_fkey" FOREIGN KEY ("universe_id") REFERENCES "public"."roblox_universes"("universe_id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."roblox_universe_search_snapshots"
    ADD CONSTRAINT "roblox_universe_search_snapshots_universe_id_fkey" FOREIGN KEY ("universe_id") REFERENCES "public"."roblox_universes"("universe_id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."roblox_universe_social_links"
    ADD CONSTRAINT "roblox_universe_social_links_universe_id_fkey" FOREIGN KEY ("universe_id") REFERENCES "public"."roblox_universes"("universe_id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."roblox_universe_sort_entries"
    ADD CONSTRAINT "roblox_universe_sort_entries_run_id_fkey" FOREIGN KEY ("run_id") REFERENCES "public"."roblox_universe_sort_runs"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."roblox_universe_sort_entries"
    ADD CONSTRAINT "roblox_universe_sort_entries_sort_id_fkey" FOREIGN KEY ("sort_id") REFERENCES "public"."roblox_universe_sort_definitions"("sort_id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."roblox_universe_sort_entries"
    ADD CONSTRAINT "roblox_universe_sort_entries_universe_id_fkey" FOREIGN KEY ("universe_id") REFERENCES "public"."roblox_universes"("universe_id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."roblox_universe_stats_daily"
    ADD CONSTRAINT "roblox_universe_stats_daily_universe_id_fkey" FOREIGN KEY ("universe_id") REFERENCES "public"."roblox_universes"("universe_id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."roblox_universe_stats_hourly"
    ADD CONSTRAINT "roblox_universe_stats_hourly_universe_id_fkey" FOREIGN KEY ("universe_id") REFERENCES "public"."roblox_universes"("universe_id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."roblox_virtual_event_categories"
    ADD CONSTRAINT "roblox_virtual_event_categories_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "public"."roblox_virtual_events"("event_id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."roblox_virtual_event_thumbnails"
    ADD CONSTRAINT "roblox_virtual_event_thumbnails_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "public"."roblox_virtual_events"("event_id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."roblox_virtual_events"
    ADD CONSTRAINT "roblox_virtual_events_universe_id_fkey" FOREIGN KEY ("universe_id") REFERENCES "public"."roblox_universes"("universe_id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."tools"
    ADD CONSTRAINT "tools_universe_id_fkey" FOREIGN KEY ("universe_id") REFERENCES "public"."roblox_universes"("universe_id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."user_checklist_progress"
    ADD CONSTRAINT "user_checklist_progress_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."app_users"("user_id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."user_code_progress"
    ADD CONSTRAINT "user_code_progress_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."app_users"("user_id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."user_quiz_progress"
    ADD CONSTRAINT "user_quiz_progress_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."app_users"("user_id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."wiki_catalog_pages"
    ADD CONSTRAINT "wiki_catalog_pages_universe_id_fkey" FOREIGN KEY ("universe_id") REFERENCES "public"."roblox_universes"("universe_id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."wiki_catalog_pages"
    ADD CONSTRAINT "wiki_catalog_pages_wiki_page_id_fkey" FOREIGN KEY ("wiki_page_id") REFERENCES "public"."wiki_pages"("id") ON DELETE SET NULL;



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


ALTER TABLE "public"."catalog_pages" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."checklist_items" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."checklist_pages" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."codes" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."comments" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "comments_insert_authenticated" ON "public"."comments" FOR INSERT WITH CHECK ((("auth"."uid"() = "author_id") AND ("status" = 'pending'::"text") AND ("moderation" IS NULL)));



CREATE POLICY "comments_insert_guest" ON "public"."comments" FOR INSERT WITH CHECK ((("auth"."uid"() IS NULL) AND ("author_id" IS NULL) AND ("guest_name" IS NOT NULL) AND ("length"(TRIM(BOTH FROM "guest_name")) >= 2) AND ("guest_email" IS NOT NULL) AND (POSITION(('@'::"text") IN ("guest_email")) > 1) AND ("status" = 'pending'::"text") AND ("moderation" IS NULL)));



CREATE POLICY "comments_select_public" ON "public"."comments" FOR SELECT USING ((("status" = 'approved'::"text") OR ("author_id" = "auth"."uid"())));



ALTER TABLE "public"."event_guide_generation_queue" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."events_pages" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."game_generation_queue" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."game_list_entries" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."game_lists" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."games" ENABLE ROW LEVEL SECURITY;


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


ALTER TABLE "public"."roblox_catalog_categories" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."roblox_catalog_discovery_hits" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."roblox_catalog_discovery_runs" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."roblox_catalog_item_images" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."roblox_catalog_items" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."roblox_catalog_items_history" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."roblox_catalog_refresh_queue" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."roblox_catalog_subcategories" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."roblox_groups" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."roblox_music_ids" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."roblox_universe_badges" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."roblox_universe_discovery_jobs" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."roblox_universe_gamepasses" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."roblox_universe_media" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."roblox_universe_place_servers" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."roblox_universe_rank_snapshots" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "roblox_universe_rank_snapshots_select" ON "public"."roblox_universe_rank_snapshots" FOR SELECT USING (true);



ALTER TABLE "public"."roblox_universe_search_snapshots" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."roblox_universe_social_links" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."roblox_universe_sort_definitions" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."roblox_universe_sort_entries" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."roblox_universe_sort_runs" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."roblox_universe_stats_daily" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."roblox_universe_stats_hourly" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "roblox_universe_stats_hourly_select" ON "public"."roblox_universe_stats_hourly" FOR SELECT USING (true);



ALTER TABLE "public"."roblox_universes" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."roblox_virtual_event_categories" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."roblox_virtual_event_thumbnails" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."roblox_virtual_events" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."search_index" ENABLE ROW LEVEL SECURITY;


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



ALTER TABLE "public"."wiki_catalog_pages" ENABLE ROW LEVEL SECURITY;


GRANT USAGE ON SCHEMA "extensions" TO "anon";
GRANT USAGE ON SCHEMA "extensions" TO "authenticated";
GRANT USAGE ON SCHEMA "extensions" TO "service_role";
GRANT ALL ON SCHEMA "extensions" TO "dashboard_user";



GRANT USAGE ON SCHEMA "public" TO "postgres";
GRANT USAGE ON SCHEMA "public" TO "anon";
GRANT USAGE ON SCHEMA "public" TO "authenticated";
GRANT USAGE ON SCHEMA "public" TO "service_role";



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



GRANT ALL ON FUNCTION "public"."enqueue_list_revalidation_for_universe"("p_universe_id" bigint, "p_source" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."enqueue_list_revalidation_for_universe"("p_universe_id" bigint, "p_source" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."enqueue_list_revalidation_for_universe"("p_universe_id" bigint, "p_source" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."enqueue_music_revalidation_scope"("p_section" "text", "p_value" "text", "p_source" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."enqueue_music_revalidation_scope"("p_section" "text", "p_value" "text", "p_source" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."enqueue_music_revalidation_scope"("p_section" "text", "p_value" "text", "p_source" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."enqueue_revalidation"("p_entity_type" "text", "p_slug" "text", "p_source" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."enqueue_revalidation"("p_entity_type" "text", "p_slug" "text", "p_source" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."enqueue_revalidation"("p_entity_type" "text", "p_slug" "text", "p_source" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."enqueue_wiki_revalidation_for_list"("p_list_id" "uuid", "p_source" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."enqueue_wiki_revalidation_for_list"("p_list_id" "uuid", "p_source" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."enqueue_wiki_revalidation_for_list"("p_list_id" "uuid", "p_source" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."enqueue_wiki_revalidation_for_universe"("p_universe_id" bigint, "p_source" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."enqueue_wiki_revalidation_for_universe"("p_universe_id" bigint, "p_source" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."enqueue_wiki_revalidation_for_universe"("p_universe_id" bigint, "p_source" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."get_items_needing_metrics_calculation"("p_limit" integer, "p_max_age_hours" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."get_items_needing_metrics_calculation"("p_limit" integer, "p_max_age_hours" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_items_needing_metrics_calculation"("p_limit" integer, "p_max_age_hours" integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."get_items_needing_rap_update"("p_limit" integer, "p_max_age_hours" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."get_items_needing_rap_update"("p_limit" integer, "p_max_age_hours" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_items_needing_rap_update"("p_limit" integer, "p_max_age_hours" integer) TO "service_role";



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



GRANT ALL ON FUNCTION "public"."qualifies_for_free_items_catalog"("p_price_robux" bigint, "p_is_deleted" boolean, "p_raw_economy_json" "jsonb", "p_has_resellers" boolean, "p_lowest_resale_price_robux" bigint, "p_name" "text", "p_category" "text", "p_subcategory" "text", "p_favorite_count" bigint) TO "anon";
GRANT ALL ON FUNCTION "public"."qualifies_for_free_items_catalog"("p_price_robux" bigint, "p_is_deleted" boolean, "p_raw_economy_json" "jsonb", "p_has_resellers" boolean, "p_lowest_resale_price_robux" bigint, "p_name" "text", "p_category" "text", "p_subcategory" "text", "p_favorite_count" bigint) TO "authenticated";
GRANT ALL ON FUNCTION "public"."qualifies_for_free_items_catalog"("p_price_robux" bigint, "p_is_deleted" boolean, "p_raw_economy_json" "jsonb", "p_has_resellers" boolean, "p_lowest_resale_price_robux" bigint, "p_name" "text", "p_category" "text", "p_subcategory" "text", "p_favorite_count" bigint) TO "service_role";



GRANT ALL ON FUNCTION "public"."refresh_search_index_music"() TO "anon";
GRANT ALL ON FUNCTION "public"."refresh_search_index_music"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."refresh_search_index_music"() TO "service_role";



GRANT ALL ON FUNCTION "public"."revalidation_slugify"("p_value" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."revalidation_slugify"("p_value" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."revalidation_slugify"("p_value" "text") TO "service_role";



REVOKE ALL ON FUNCTION "public"."rollup_roblox_universe_stats_daily"("p_stat_date" "date", "p_finalize" boolean, "p_universe_ids" bigint[]) FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."rollup_roblox_universe_stats_daily"("p_stat_date" "date", "p_finalize" boolean, "p_universe_ids" bigint[]) TO "service_role";



GRANT ALL ON FUNCTION "public"."run_game_list_sql"("sql_text" "text", "limit_count" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."run_game_list_sql"("sql_text" "text", "limit_count" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."run_game_list_sql"("sql_text" "text", "limit_count" integer) TO "service_role";



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



GRANT ALL ON FUNCTION "public"."set_game_published_at"() TO "anon";
GRANT ALL ON FUNCTION "public"."set_game_published_at"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."set_game_published_at"() TO "service_role";



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



GRANT ALL ON FUNCTION "public"."trg_enqueue_revalidation_codes"() TO "anon";
GRANT ALL ON FUNCTION "public"."trg_enqueue_revalidation_codes"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."trg_enqueue_revalidation_codes"() TO "service_role";



GRANT ALL ON FUNCTION "public"."trg_enqueue_revalidation_events_pages"() TO "anon";
GRANT ALL ON FUNCTION "public"."trg_enqueue_revalidation_events_pages"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."trg_enqueue_revalidation_events_pages"() TO "service_role";



GRANT ALL ON FUNCTION "public"."trg_enqueue_revalidation_free_item_images"() TO "anon";
GRANT ALL ON FUNCTION "public"."trg_enqueue_revalidation_free_item_images"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."trg_enqueue_revalidation_free_item_images"() TO "service_role";



GRANT ALL ON FUNCTION "public"."trg_enqueue_revalidation_free_items_catalog"() TO "anon";
GRANT ALL ON FUNCTION "public"."trg_enqueue_revalidation_free_items_catalog"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."trg_enqueue_revalidation_free_items_catalog"() TO "service_role";



GRANT ALL ON FUNCTION "public"."trg_enqueue_revalidation_game_list_entries"() TO "anon";
GRANT ALL ON FUNCTION "public"."trg_enqueue_revalidation_game_list_entries"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."trg_enqueue_revalidation_game_list_entries"() TO "service_role";



GRANT ALL ON FUNCTION "public"."trg_enqueue_revalidation_game_lists"() TO "anon";
GRANT ALL ON FUNCTION "public"."trg_enqueue_revalidation_game_lists"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."trg_enqueue_revalidation_game_lists"() TO "service_role";



GRANT ALL ON FUNCTION "public"."trg_enqueue_revalidation_games"() TO "anon";
GRANT ALL ON FUNCTION "public"."trg_enqueue_revalidation_games"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."trg_enqueue_revalidation_games"() TO "service_role";



GRANT ALL ON FUNCTION "public"."trg_enqueue_revalidation_lists_roblox_universe"() TO "anon";
GRANT ALL ON FUNCTION "public"."trg_enqueue_revalidation_lists_roblox_universe"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."trg_enqueue_revalidation_lists_roblox_universe"() TO "service_role";



GRANT ALL ON FUNCTION "public"."trg_enqueue_revalidation_music_ids"() TO "anon";
GRANT ALL ON FUNCTION "public"."trg_enqueue_revalidation_music_ids"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."trg_enqueue_revalidation_music_ids"() TO "service_role";



GRANT ALL ON FUNCTION "public"."trg_enqueue_revalidation_puzzle_answers"() TO "anon";
GRANT ALL ON FUNCTION "public"."trg_enqueue_revalidation_puzzle_answers"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."trg_enqueue_revalidation_puzzle_answers"() TO "service_role";



GRANT ALL ON FUNCTION "public"."trg_enqueue_revalidation_puzzle_pages"() TO "anon";
GRANT ALL ON FUNCTION "public"."trg_enqueue_revalidation_puzzle_pages"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."trg_enqueue_revalidation_puzzle_pages"() TO "service_role";



GRANT ALL ON FUNCTION "public"."trg_enqueue_revalidation_quiz_pages"() TO "anon";
GRANT ALL ON FUNCTION "public"."trg_enqueue_revalidation_quiz_pages"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."trg_enqueue_revalidation_quiz_pages"() TO "service_role";



GRANT ALL ON FUNCTION "public"."trg_enqueue_revalidation_tools"() TO "anon";
GRANT ALL ON FUNCTION "public"."trg_enqueue_revalidation_tools"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."trg_enqueue_revalidation_tools"() TO "service_role";



GRANT ALL ON FUNCTION "public"."trg_enqueue_revalidation_virtual_event_assets"() TO "anon";
GRANT ALL ON FUNCTION "public"."trg_enqueue_revalidation_virtual_event_assets"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."trg_enqueue_revalidation_virtual_event_assets"() TO "service_role";



GRANT ALL ON FUNCTION "public"."trg_enqueue_revalidation_virtual_events"() TO "anon";
GRANT ALL ON FUNCTION "public"."trg_enqueue_revalidation_virtual_events"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."trg_enqueue_revalidation_virtual_events"() TO "service_role";



GRANT ALL ON FUNCTION "public"."trg_enqueue_revalidation_wiki_catalog_pages"() TO "anon";
GRANT ALL ON FUNCTION "public"."trg_enqueue_revalidation_wiki_catalog_pages"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."trg_enqueue_revalidation_wiki_catalog_pages"() TO "service_role";



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



GRANT ALL ON FUNCTION "public"."trg_search_index_events_pages"() TO "anon";
GRANT ALL ON FUNCTION "public"."trg_search_index_events_pages"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."trg_search_index_events_pages"() TO "service_role";



GRANT ALL ON FUNCTION "public"."trg_search_index_game_lists"() TO "anon";
GRANT ALL ON FUNCTION "public"."trg_search_index_game_lists"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."trg_search_index_game_lists"() TO "service_role";



GRANT ALL ON FUNCTION "public"."trg_search_index_games"() TO "anon";
GRANT ALL ON FUNCTION "public"."trg_search_index_games"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."trg_search_index_games"() TO "service_role";



GRANT ALL ON FUNCTION "public"."trg_search_index_puzzle_pages"() TO "anon";
GRANT ALL ON FUNCTION "public"."trg_search_index_puzzle_pages"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."trg_search_index_puzzle_pages"() TO "service_role";



GRANT ALL ON FUNCTION "public"."trg_search_index_quiz_pages"() TO "anon";
GRANT ALL ON FUNCTION "public"."trg_search_index_quiz_pages"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."trg_search_index_quiz_pages"() TO "service_role";



GRANT ALL ON FUNCTION "public"."trg_search_index_tools"() TO "anon";
GRANT ALL ON FUNCTION "public"."trg_search_index_tools"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."trg_search_index_tools"() TO "service_role";



GRANT ALL ON FUNCTION "public"."trg_search_index_wiki_catalog_pages"() TO "anon";
GRANT ALL ON FUNCTION "public"."trg_search_index_wiki_catalog_pages"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."trg_search_index_wiki_catalog_pages"() TO "service_role";



GRANT ALL ON FUNCTION "public"."trg_search_index_wiki_pages"() TO "anon";
GRANT ALL ON FUNCTION "public"."trg_search_index_wiki_pages"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."trg_search_index_wiki_pages"() TO "service_role";



GRANT ALL ON FUNCTION "public"."upsert_code"("p_game_id" "uuid", "p_code" "text", "p_status" "text", "p_rewards_text" "text", "p_level_requirement" integer, "p_is_new" boolean) TO "anon";
GRANT ALL ON FUNCTION "public"."upsert_code"("p_game_id" "uuid", "p_code" "text", "p_status" "text", "p_rewards_text" "text", "p_level_requirement" integer, "p_is_new" boolean) TO "authenticated";
GRANT ALL ON FUNCTION "public"."upsert_code"("p_game_id" "uuid", "p_code" "text", "p_status" "text", "p_rewards_text" "text", "p_level_requirement" integer, "p_is_new" boolean) TO "service_role";



GRANT ALL ON FUNCTION "public"."upsert_code"("p_game_id" "uuid", "p_code" "text", "p_status" "text", "p_rewards_text" "text", "p_level_requirement" integer, "p_is_new" boolean, "p_provider_priority" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."upsert_code"("p_game_id" "uuid", "p_code" "text", "p_status" "text", "p_rewards_text" "text", "p_level_requirement" integer, "p_is_new" boolean, "p_provider_priority" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."upsert_code"("p_game_id" "uuid", "p_code" "text", "p_status" "text", "p_rewards_text" "text", "p_level_requirement" integer, "p_is_new" boolean, "p_provider_priority" integer) TO "service_role";



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



GRANT ALL ON TABLE "public"."authors" TO "anon";
GRANT ALL ON TABLE "public"."authors" TO "authenticated";
GRANT ALL ON TABLE "public"."authors" TO "service_role";



GRANT ALL ON TABLE "public"."roblox_universes" TO "anon";
GRANT ALL ON TABLE "public"."roblox_universes" TO "authenticated";
GRANT ALL ON TABLE "public"."roblox_universes" TO "service_role";



GRANT ALL ON TABLE "public"."article_pages_index_view" TO "anon";
GRANT ALL ON TABLE "public"."article_pages_index_view" TO "authenticated";
GRANT ALL ON TABLE "public"."article_pages_index_view" TO "service_role";



GRANT ALL ON TABLE "public"."article_pages_view" TO "anon";
GRANT ALL ON TABLE "public"."article_pages_view" TO "authenticated";
GRANT ALL ON TABLE "public"."article_pages_view" TO "service_role";



GRANT ALL ON TABLE "public"."article_source_images" TO "anon";
GRANT ALL ON TABLE "public"."article_source_images" TO "authenticated";
GRANT ALL ON TABLE "public"."article_source_images" TO "service_role";



GRANT ALL ON TABLE "public"."catalog_pages" TO "anon";
GRANT ALL ON TABLE "public"."catalog_pages" TO "authenticated";
GRANT ALL ON TABLE "public"."catalog_pages" TO "service_role";



GRANT ALL ON TABLE "public"."catalog_pages_view" TO "anon";
GRANT ALL ON TABLE "public"."catalog_pages_view" TO "authenticated";
GRANT ALL ON TABLE "public"."catalog_pages_view" TO "service_role";



GRANT ALL ON TABLE "public"."checklist_items" TO "anon";
GRANT ALL ON TABLE "public"."checklist_items" TO "authenticated";
GRANT ALL ON TABLE "public"."checklist_items" TO "service_role";



GRANT ALL ON TABLE "public"."checklist_pages" TO "anon";
GRANT ALL ON TABLE "public"."checklist_pages" TO "authenticated";
GRANT ALL ON TABLE "public"."checklist_pages" TO "service_role";



GRANT ALL ON TABLE "public"."checklist_pages_view" TO "anon";
GRANT ALL ON TABLE "public"."checklist_pages_view" TO "authenticated";
GRANT ALL ON TABLE "public"."checklist_pages_view" TO "service_role";



GRANT ALL ON TABLE "public"."codes" TO "anon";
GRANT ALL ON TABLE "public"."codes" TO "authenticated";
GRANT ALL ON TABLE "public"."codes" TO "service_role";



GRANT ALL ON TABLE "public"."games" TO "anon";
GRANT ALL ON TABLE "public"."games" TO "authenticated";
GRANT ALL ON TABLE "public"."games" TO "service_role";



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



GRANT ALL ON TABLE "public"."game_code_stats" TO "anon";
GRANT ALL ON TABLE "public"."game_code_stats" TO "authenticated";
GRANT ALL ON TABLE "public"."game_code_stats" TO "service_role";



GRANT ALL ON TABLE "public"."game_generation_queue" TO "anon";
GRANT ALL ON TABLE "public"."game_generation_queue" TO "authenticated";
GRANT ALL ON TABLE "public"."game_generation_queue" TO "service_role";



GRANT ALL ON TABLE "public"."game_list_entries" TO "anon";
GRANT ALL ON TABLE "public"."game_list_entries" TO "authenticated";
GRANT ALL ON TABLE "public"."game_list_entries" TO "service_role";



GRANT ALL ON TABLE "public"."game_lists" TO "anon";
GRANT ALL ON TABLE "public"."game_lists" TO "authenticated";
GRANT ALL ON TABLE "public"."game_lists" TO "service_role";



GRANT ALL ON TABLE "public"."game_lists_index_view" TO "anon";
GRANT ALL ON TABLE "public"."game_lists_index_view" TO "authenticated";
GRANT ALL ON TABLE "public"."game_lists_index_view" TO "service_role";



GRANT ALL ON TABLE "public"."game_lists_view" TO "anon";
GRANT ALL ON TABLE "public"."game_lists_view" TO "authenticated";
GRANT ALL ON TABLE "public"."game_lists_view" TO "service_role";



GRANT ALL ON TABLE "public"."game_pages_index_view" TO "anon";
GRANT ALL ON TABLE "public"."game_pages_index_view" TO "authenticated";
GRANT ALL ON TABLE "public"."game_pages_index_view" TO "service_role";



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



GRANT ALL ON TABLE "public"."quiz_pages_view" TO "anon";
GRANT ALL ON TABLE "public"."quiz_pages_view" TO "authenticated";
GRANT ALL ON TABLE "public"."quiz_pages_view" TO "service_role";



GRANT ALL ON TABLE "public"."revalidation_events" TO "anon";
GRANT ALL ON TABLE "public"."revalidation_events" TO "authenticated";
GRANT ALL ON TABLE "public"."revalidation_events" TO "service_role";



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



GRANT ALL ON TABLE "public"."roblox_catalog_items_history" TO "anon";
GRANT ALL ON TABLE "public"."roblox_catalog_items_history" TO "authenticated";
GRANT ALL ON TABLE "public"."roblox_catalog_items_history" TO "service_role";



GRANT ALL ON TABLE "public"."roblox_catalog_refresh_queue" TO "anon";
GRANT ALL ON TABLE "public"."roblox_catalog_refresh_queue" TO "authenticated";
GRANT ALL ON TABLE "public"."roblox_catalog_refresh_queue" TO "service_role";



GRANT ALL ON TABLE "public"."roblox_catalog_subcategories" TO "anon";
GRANT ALL ON TABLE "public"."roblox_catalog_subcategories" TO "authenticated";
GRANT ALL ON TABLE "public"."roblox_catalog_subcategories" TO "service_role";



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



GRANT ALL ON TABLE "public"."roblox_universe_badges" TO "anon";
GRANT ALL ON TABLE "public"."roblox_universe_badges" TO "authenticated";
GRANT ALL ON TABLE "public"."roblox_universe_badges" TO "service_role";



GRANT ALL ON TABLE "public"."roblox_universe_discovery_jobs" TO "anon";
GRANT ALL ON TABLE "public"."roblox_universe_discovery_jobs" TO "authenticated";
GRANT ALL ON TABLE "public"."roblox_universe_discovery_jobs" TO "service_role";



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



GRANT ALL ON TABLE "public"."roblox_universe_search_snapshots" TO "anon";
GRANT ALL ON TABLE "public"."roblox_universe_search_snapshots" TO "authenticated";
GRANT ALL ON TABLE "public"."roblox_universe_search_snapshots" TO "service_role";



GRANT ALL ON TABLE "public"."roblox_universe_social_links" TO "anon";
GRANT ALL ON TABLE "public"."roblox_universe_social_links" TO "authenticated";
GRANT ALL ON TABLE "public"."roblox_universe_social_links" TO "service_role";



GRANT ALL ON TABLE "public"."roblox_universe_sort_definitions" TO "anon";
GRANT ALL ON TABLE "public"."roblox_universe_sort_definitions" TO "authenticated";
GRANT ALL ON TABLE "public"."roblox_universe_sort_definitions" TO "service_role";



GRANT ALL ON TABLE "public"."roblox_universe_sort_entries" TO "anon";
GRANT ALL ON TABLE "public"."roblox_universe_sort_entries" TO "authenticated";
GRANT ALL ON TABLE "public"."roblox_universe_sort_entries" TO "service_role";



GRANT ALL ON TABLE "public"."roblox_universe_sort_runs" TO "anon";
GRANT ALL ON TABLE "public"."roblox_universe_sort_runs" TO "authenticated";
GRANT ALL ON TABLE "public"."roblox_universe_sort_runs" TO "service_role";



GRANT ALL ON TABLE "public"."roblox_universe_stats_daily" TO "anon";
GRANT ALL ON TABLE "public"."roblox_universe_stats_daily" TO "authenticated";
GRANT ALL ON TABLE "public"."roblox_universe_stats_daily" TO "service_role";



GRANT ALL ON TABLE "public"."roblox_universe_stats_hourly" TO "anon";
GRANT ALL ON TABLE "public"."roblox_universe_stats_hourly" TO "authenticated";
GRANT ALL ON TABLE "public"."roblox_universe_stats_hourly" TO "service_role";



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



GRANT ALL ON TABLE "public"."tools" TO "anon";
GRANT ALL ON TABLE "public"."tools" TO "authenticated";
GRANT ALL ON TABLE "public"."tools" TO "service_role";



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



GRANT ALL ON TABLE "public"."wiki_catalog_pages" TO "anon";
GRANT ALL ON TABLE "public"."wiki_catalog_pages" TO "authenticated";
GRANT ALL ON TABLE "public"."wiki_catalog_pages" TO "service_role";



GRANT ALL ON TABLE "public"."wiki_catalog_pages_view" TO "anon";
GRANT ALL ON TABLE "public"."wiki_catalog_pages_view" TO "authenticated";
GRANT ALL ON TABLE "public"."wiki_catalog_pages_view" TO "service_role";



GRANT ALL ON TABLE "public"."wiki_pages" TO "anon";
GRANT ALL ON TABLE "public"."wiki_pages" TO "authenticated";
GRANT ALL ON TABLE "public"."wiki_pages" TO "service_role";



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
