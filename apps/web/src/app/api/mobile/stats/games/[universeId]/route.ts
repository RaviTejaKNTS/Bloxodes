import { NextResponse } from "next/server";
import { getStatsGameSummaryByUniverseId, loadLatestRank } from "@/lib/stats";

export const dynamic = "force-dynamic";

const RESPONSE_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
  "Cache-Control": "public, max-age=60, s-maxage=300"
};

export async function OPTIONS() {
  return new Response(null, {
    status: 204,
    headers: RESPONSE_HEADERS
  });
}

export async function GET(_request: Request, context: { params: Promise<{ universeId: string }> }) {
  try {
    const { universeId } = await context.params;
    const id = Number(universeId);
    if (!Number.isFinite(id)) {
      return NextResponse.json({ error: "Invalid universe ID" }, { status: 400, headers: RESPONSE_HEADERS });
    }
    const [base, latestRank] = await Promise.all([getStatsGameSummaryByUniverseId(id), loadLatestRank(id)]);
    const game = base ? { ...base, rank: latestRank ?? null } : null;
    return NextResponse.json({ game }, { headers: RESPONSE_HEADERS });
  } catch (error) {
    console.error("Failed to load mobile stats game", error);
    return NextResponse.json({ error: "Failed to load stats game" }, { status: 500, headers: RESPONSE_HEADERS });
  }
}
