import { NextResponse } from "next/server";
import { getStatsGameCharts } from "@/lib/stats";

export const dynamic = "force-dynamic";

type RouteContext = {
  params: Promise<{ universeId: string }>;
};

export async function GET(request: Request, context: RouteContext) {
  try {
    const { universeId } = await context.params;
    const id = Number(universeId);
    if (!Number.isFinite(id)) {
      return NextResponse.json({ error: "Invalid universe ID" }, { status: 400 });
    }
    const range = new URL(request.url).searchParams.get("range");
    const charts = await getStatsGameCharts(id);
    const payload = range && range in charts ? { range, points: charts[range as keyof typeof charts] } : { charts };
    return NextResponse.json(payload, {
      headers: {
        "cache-control": "public, max-age=300, stale-while-revalidate=900"
      }
    });
  } catch (error) {
    console.error("Failed to load stats chart", error);
    return NextResponse.json({ error: "Failed to load stats chart" }, { status: 500 });
  }
}
