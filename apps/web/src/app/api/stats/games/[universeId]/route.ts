import { NextResponse } from "next/server";
import { getStatsGameSummaryByUniverseId, loadLatestRank } from "@/lib/stats";

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
    const [base, latestRank] = await Promise.all([getStatsGameSummaryByUniverseId(id), loadLatestRank(id)]);
    // Match the stats page, which displays the latest hourly-snapshot rank.
    const game = base ? { ...base, rank: latestRank ?? null } : null;
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
