import { NextResponse } from "next/server";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { isStaleTimestamp } from "@/lib/health";
import {
  evaluateStatsPipelineHealth,
  type StatsPipelineHealthSnapshot
} from "@/lib/stats-pipeline-health";
import { supabaseAdmin } from "@/lib/supabase-admin";

export const dynamic = "force-dynamic";
export const revalidate = 0;

function readBuildSha() {
  const envSha =
    process.env.BLOXODES_BUILD_SHA ||
    process.env.GIT_COMMIT_SHA ||
    process.env.NEXT_PUBLIC_VERCEL_GIT_COMMIT_SHA;

  if (envSha && envSha !== "unknown") {
    return envSha;
  }

  const buildShaPaths = [
    join(process.cwd(), "build-sha"),
    join(process.cwd(), "..", "..", "build-sha"),
    "/app/build-sha"
  ];

  for (const buildShaPath of buildShaPaths) {
    if (!existsSync(buildShaPath)) continue;

    const fileSha = readFileSync(buildShaPath, "utf8").trim();
    if (fileSha) {
      return fileSha;
    }
  }

  return envSha || "unknown";
}

export async function GET(request: Request) {
  const supabase = supabaseAdmin();
  const deployScope = new URL(request.url).searchParams.get("scope") === "deploy";
  const databaseCheck = await supabase.from("code_pages").select("id", { head: true }).limit(1);
  const databaseOk = !databaseCheck.error;
  const timestamp = new Date().toISOString();
  const build = { sha: readBuildSha() };
  const features = {
    cacheTags: true,
    cacheHeaderVersion: 4,
    publicHtmlCacheHeaders: "cloudflare-200-only",
    publicPageRendering: "isr",
    cloudflarePurgeStrategy: process.env.CLOUDFLARE_PURGE_STRATEGY || "tags"
  };
  const database = {
    ok: databaseOk,
    error: databaseCheck.error?.message ?? null
  };

  // Container and deployment readiness must remain lightweight. The operational
  // endpoint below performs the deeper stats checks used by monitoring.
  if (deployScope) {
    return NextResponse.json(
      {
        ok: databaseOk,
        status: databaseOk ? "healthy" : "unhealthy",
        scope: "deploy",
        timestamp,
        build,
        features,
        checks: { database }
      },
      {
        status: databaseOk ? 200 : 503,
        headers: {
          "Cache-Control": "no-store, max-age=0"
        }
      }
    );
  }

  const playingCutoff = new Date(Date.now() - 24 * 60 * 60 * 1_000).toISOString();

  let statsLatestAt: string | null = null;
  let statsSource = "stats_game_current_index";
  const currentIndex = await supabase
    .from("stats_game_current_index")
    .select("indexed_at")
    .order("indexed_at", { ascending: false, nullsFirst: false })
    .limit(1)
    .maybeSingle();
  if (!currentIndex.error) {
    statsLatestAt = typeof currentIndex.data?.indexed_at === "string" ? currentIndex.data.indexed_at : null;
  } else {
    statsSource = "roblox_universes";
    const universeFallback = await supabase
      .from("roblox_universes")
      .select("last_stats_refreshed_at")
      .order("last_stats_refreshed_at", { ascending: false, nullsFirst: false })
      .limit(1)
      .maybeSingle();
    statsLatestAt = typeof universeFallback.data?.last_stats_refreshed_at === "string"
      ? universeFallback.data.last_stats_refreshed_at
      : null;
  }

  const [freshPlayers, stalePlayerValues] = await Promise.all([
    supabase
      .from("stats_game_current_index")
      .select("universe_id", { head: true, count: "exact" })
      .not("playing", "is", null)
      .gte("last_playing_refreshed_at", playingCutoff),
    supabase
      .from("roblox_universes")
      .select("universe_id", { head: true, count: "exact" })
      .not("playing", "is", null)
      .or(`last_playing_refreshed_at.is.null,last_playing_refreshed_at.lt.${playingCutoff}`)
  ]);

  const pipelineHealth = await supabase.rpc("get_roblox_universe_pipeline_health_v4");
  const evaluatedStats = pipelineHealth.error
    ? null
    : evaluateStatsPipelineHealth(pipelineHealth.data as StatsPipelineHealthSnapshot);
  const statsOperational = evaluatedStats?.status !== "unhealthy";
  const ok = databaseOk && pipelineHealth.error == null && statsOperational;
  return NextResponse.json(
    {
      ok,
      status: !databaseOk || pipelineHealth.error || evaluatedStats?.status === "unhealthy"
        ? "unhealthy"
        : evaluatedStats?.status ?? "healthy",
      scope: "operational",
      timestamp,
      build,
      features,
      checks: {
        database,
        statsIndex: {
          source: statsSource,
          latestAt: statsLatestAt,
          stale: isStaleTimestamp(statsLatestAt)
        },
        statsPlayers: {
          freshnessHours: 24,
          freshCurrentValues: freshPlayers.count ?? null,
          staleStoredValues: stalePlayerValues.count ?? null,
          error: freshPlayers.error?.message ?? stalePlayerValues.error?.message ?? null
        },
        statsPipeline: {
          ok: pipelineHealth.error == null && statsOperational,
          status: evaluatedStats?.status ?? "unavailable",
          checks: evaluatedStats?.checks ?? [],
          snapshot: pipelineHealth.data ?? null,
          error: pipelineHealth.error?.message ?? null
        }
      }
    },
    {
      status: ok ? 200 : 503,
      headers: {
        "Cache-Control": "no-store, max-age=0"
      }
    }
  );
}
