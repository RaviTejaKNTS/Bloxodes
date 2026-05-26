import { NextResponse } from "next/server";
import { getStatsGameSummaryByUniverseId } from "@/lib/stats";

export const dynamic = "force-dynamic";

type RouteContext = {
  params: Promise<{ universeId: string }>;
};

export async function GET(_request: Request, context: RouteContext) {
  try {
    const { universeId } = await context.params;
    const id = Number(universeId);
    if (!Number.isFinite(id)) {
      return NextResponse.json({ error: "Invalid universe ID" }, { status: 400 });
    }
    const game = await getStatsGameSummaryByUniverseId(id);
    return NextResponse.json({ game }, {
      headers: {
        "cache-control": "public, max-age=60, stale-while-revalidate=300"
      }
    });
  } catch (error) {
    console.error("Failed to load stats game", error);
    return NextResponse.json({ error: "Failed to load stats game" }, { status: 500 });
  }
}
