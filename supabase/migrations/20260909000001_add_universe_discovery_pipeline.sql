ALTER TABLE "public"."roblox_universes"
  ADD COLUMN IF NOT EXISTS "discovery_score" numeric,
  ADD COLUMN IF NOT EXISTS "quality_score" numeric,
  ADD COLUMN IF NOT EXISTS "quality_tier" text,
  ADD COLUMN IF NOT EXISTS "quality_reasons" jsonb DEFAULT '[]'::jsonb NOT NULL,
  ADD COLUMN IF NOT EXISTS "last_quality_scored_at" timestamp with time zone,
  ADD COLUMN IF NOT EXISTS "last_light_enriched_at" timestamp with time zone,
  ADD COLUMN IF NOT EXISTS "last_deep_enriched_at" timestamp with time zone,
  ADD COLUMN IF NOT EXISTS "last_stats_refreshed_at" timestamp with time zone,
  ADD COLUMN IF NOT EXISTS "last_playing_refreshed_at" timestamp with time zone,
  ADD COLUMN IF NOT EXISTS "discovery_sources" jsonb DEFAULT '[]'::jsonb NOT NULL,
  ADD COLUMN IF NOT EXISTS "is_quality_candidate" boolean;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM "pg_constraint"
    WHERE "conname" = 'roblox_universes_quality_tier_check'
  ) THEN
    ALTER TABLE "public"."roblox_universes"
      ADD CONSTRAINT "roblox_universes_quality_tier_check"
      CHECK (
        "quality_tier" IS NULL
        OR "quality_tier" IN ('A', 'B', 'C', 'D', 'archive')
      );
  END IF;
END
$$;

CREATE INDEX IF NOT EXISTS "idx_roblox_universes_quality"
  ON "public"."roblox_universes" ("quality_tier", "quality_score" DESC NULLS LAST);

CREATE INDEX IF NOT EXISTS "idx_roblox_universes_light_enriched"
  ON "public"."roblox_universes" ("last_light_enriched_at" ASC NULLS FIRST, "last_seen_in_search" DESC NULLS LAST);

CREATE INDEX IF NOT EXISTS "idx_roblox_universes_deep_enriched"
  ON "public"."roblox_universes" ("last_deep_enriched_at" ASC NULLS FIRST, "quality_score" DESC NULLS LAST);

CREATE TABLE IF NOT EXISTS "public"."roblox_universe_discovery_jobs" (
  "id" uuid DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
  "job_key" text NOT NULL,
  "source" text NOT NULL,
  "strategy" text NOT NULL,
  "query" text,
  "params" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "status" text DEFAULT 'pending'::text NOT NULL,
  "priority" integer DEFAULT 0 NOT NULL,
  "attempts" integer DEFAULT 0 NOT NULL,
  "max_attempts" integer DEFAULT 5 NOT NULL,
  "result_count" integer DEFAULT 0 NOT NULL,
  "new_universe_count" integer DEFAULT 0 NOT NULL,
  "cursor" text,
  "cooldown_until" timestamp with time zone,
  "next_run_at" timestamp with time zone DEFAULT "now"() NOT NULL,
  "locked_at" timestamp with time zone,
  "locked_by" text,
  "last_error" text,
  "last_run_at" timestamp with time zone,
  "completed_at" timestamp with time zone,
  "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
  CONSTRAINT "roblox_universe_discovery_jobs_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "roblox_universe_discovery_jobs_job_key_key" UNIQUE ("job_key"),
  CONSTRAINT "roblox_universe_discovery_jobs_status_check"
    CHECK ("status" IN ('pending', 'in_progress', 'completed', 'failed', 'paused'))
);

CREATE INDEX IF NOT EXISTS "idx_roblox_universe_discovery_jobs_ready"
  ON "public"."roblox_universe_discovery_jobs" ("status", "next_run_at", "priority" DESC)
  WHERE "status" IN ('pending', 'failed');

CREATE INDEX IF NOT EXISTS "idx_roblox_universe_discovery_jobs_query"
  ON "public"."roblox_universe_discovery_jobs" ("source", "strategy", "query");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM "pg_trigger"
    WHERE "tgname" = 'trg_roblox_universe_discovery_jobs_updated_at'
  ) THEN
    CREATE TRIGGER "trg_roblox_universe_discovery_jobs_updated_at"
      BEFORE UPDATE ON "public"."roblox_universe_discovery_jobs"
      FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();
  END IF;
END
$$;

ALTER TABLE "public"."roblox_universe_discovery_jobs" ENABLE ROW LEVEL SECURITY;
