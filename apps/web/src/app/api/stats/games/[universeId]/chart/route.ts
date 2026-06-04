import { NextResponse } from "next/server";
import { getStatsGameChart, normalizeStatsCompareIds, normalizeStatsRange, normalizeStatsResolution } from "@/lib/stats";

export const dynamic = "force-dynamic";

type RouteContext = {
  params: Promise<{ universeId: string }>;
};

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
    const chart = await getStatsGameChart(id, range, resolution, {
      includePrevious: searchParams.get("previous") === "1",
      includeAnnotations: searchParams.get("annotations") !== "0",
      compareUniverseIds: normalizeStatsCompareIds(searchParams.get("compare"), id)
    });
    return NextResponse.json(chart, {
      headers: {
        "cache-control": "public, max-age=300, stale-while-revalidate=1800"
      }
    });
  } catch (error) {
    console.error("Failed to load stats game chart", error);
    return NextResponse.json({ error: "Failed to load stats game chart" }, { status: 500 });
  }
}
