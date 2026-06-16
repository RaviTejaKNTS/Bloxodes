import { NextResponse } from "next/server";
import { getStatsGameRankChartByUniverseId, normalizeStatsCompareIds, normalizeStatsRange, normalizeStatsResolution } from "@/lib/stats";

export const dynamic = "force-dynamic";

type RouteContext = {
  params: Promise<{ universeId: string }>;
};

function normalizeRankScope(value: string | null) {
  return value === "genre" || value === "subgenre" ? value : "global";
}

export async function GET(request: Request, context: RouteContext) {
  try {
    const { universeId } = await context.params;
    const id = Number(universeId);
    if (!Number.isSafeInteger(id) || id <= 0) {
      return NextResponse.json({ error: "Invalid universe ID" }, { status: 400 });
    }
    const { searchParams } = new URL(request.url);
    const range = normalizeStatsRange(searchParams.get("range"));
    const resolution = normalizeStatsResolution(searchParams.get("resolution"));
    const chart = await getStatsGameRankChartByUniverseId(id, range, resolution, {
      includePrevious: searchParams.get("previous") === "1",
      includeAnnotations: searchParams.get("annotations") !== "0",
      compareUniverseIds: normalizeStatsCompareIds(searchParams.get("compare"), id),
      compareScope: normalizeRankScope(searchParams.get("scope"))
    });
    return NextResponse.json(chart, {
      headers: {
        "cache-control": "public, max-age=300, stale-while-revalidate=1800"
      }
    });
  } catch (error) {
    console.error("Failed to load stats game rank chart", error);
    return NextResponse.json({ error: "Failed to load stats game rank chart" }, { status: 500 });
  }
}
