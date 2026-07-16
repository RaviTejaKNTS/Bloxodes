import { NextResponse } from "next/server";
import { getStatsPlatformChart, normalizeStatsRange, normalizeStatsResolution } from "@/lib/stats";
import { CACHE_TAG_HEADER, serializeCacheTags } from "@/lib/public-cache-tags";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const range = normalizeStatsRange(searchParams.get("range"));
    const resolution = normalizeStatsResolution(searchParams.get("resolution"));
    const chart = await getStatsPlatformChart(range, resolution, {
      includePrevious: searchParams.get("previous") === "1"
    });
    return NextResponse.json(chart, {
      headers: {
        "cache-control": "public, max-age=300, stale-while-revalidate=1800",
        [CACHE_TAG_HEADER]: serializeCacheTags(["site", "stats", "stats-platform"])
      }
    });
  } catch (error) {
    console.error("Failed to load platform stats chart", error);
    return NextResponse.json({ error: "Failed to load platform stats chart" }, { status: 500 });
  }
}
