import { NextResponse } from "next/server";
import { getStatsVisitShareChart, normalizeVisitShareRange } from "@/lib/stats-visit-share";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const range = normalizeVisitShareRange(searchParams.get("range"));
    const chart = await getStatsVisitShareChart(range);
    return NextResponse.json(chart, {
      headers: {
        "cache-control": "public, max-age=300, stale-while-revalidate=1800"
      }
    });
  } catch (error) {
    console.error("Failed to load visit-share stats chart", error);
    return NextResponse.json({ error: "Failed to load visit-share stats chart" }, { status: 500 });
  }
}
