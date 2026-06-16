import { NextResponse } from "next/server";
import { normalizeStatsCompareIds, searchStatsGamesForCompare } from "@/lib/stats";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const q = searchParams.get("q") ?? "";
    const exclude = normalizeStatsCompareIds(searchParams.get("exclude"));
    const games = await searchStatsGamesForCompare({
      q,
      excludeUniverseIds: exclude,
      limit: 8,
      genre: searchParams.get("genre"),
      subgenre: searchParams.get("subgenre")
    });
    return NextResponse.json(
      { games },
      {
        headers: {
          "cache-control": "public, max-age=60, stale-while-revalidate=300"
        }
      }
    );
  } catch (error) {
    console.error("Failed to search stats games", error);
    return NextResponse.json({ error: "Failed to search stats games" }, { status: 500 });
  }
}
