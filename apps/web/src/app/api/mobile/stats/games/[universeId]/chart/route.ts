import { NextResponse } from "next/server";
import { getStatsGameChart, normalizeStatsRange, normalizeStatsResolution } from "@/lib/stats";

export const dynamic = "force-dynamic";

const RESPONSE_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
  "Cache-Control": "public, max-age=300, stale-while-revalidate=1800"
};

export async function OPTIONS() {
  return new Response(null, {
    status: 204,
    headers: RESPONSE_HEADERS
  });
}

export async function GET(request: Request, context: { params: Promise<{ universeId: string }> }) {
  try {
    const { universeId } = await context.params;
    const id = Number(universeId);
    if (!Number.isSafeInteger(id) || id <= 0) {
      return NextResponse.json({ error: "Invalid universe ID" }, { status: 400, headers: RESPONSE_HEADERS });
    }
    const { searchParams } = new URL(request.url);
    const range = normalizeStatsRange(searchParams.get("range"));
    const resolution = normalizeStatsResolution(searchParams.get("resolution"));
    const chart = await getStatsGameChart(id, range, resolution, {
      includePrevious: false,
      includeAnnotations: false
    });
    return NextResponse.json(chart, { headers: RESPONSE_HEADERS });
  } catch (error) {
    console.error("Failed to load mobile stats game chart", error);
    return NextResponse.json({ error: "Failed to load stats game chart" }, { status: 500, headers: RESPONSE_HEADERS });
  }
}
