import { NextResponse } from "next/server";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { isStaleTimestamp } from "@/lib/health";
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

export async function GET() {
  const supabase = supabaseAdmin();
  const databaseCheck = await supabase.from("code_pages").select("id", { head: true, count: "exact" }).limit(1);
  const databaseOk = !databaseCheck.error;

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

  const ok = databaseOk;
  return NextResponse.json(
    {
      ok,
      timestamp: new Date().toISOString(),
      build: {
        sha: readBuildSha()
      },
      features: {
        cacheTags: true,
        cacheHeaderVersion: 4,
        publicHtmlCacheHeaders: "cloudflare-200-only",
        publicPageRendering: "isr",
        cloudflarePurgeStrategy: process.env.CLOUDFLARE_PURGE_STRATEGY || "tags"
      },
      checks: {
        database: {
          ok: databaseOk,
          error: databaseCheck.error?.message ?? null
        },
        statsIndex: {
          source: statsSource,
          latestAt: statsLatestAt,
          stale: isStaleTimestamp(statsLatestAt)
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
