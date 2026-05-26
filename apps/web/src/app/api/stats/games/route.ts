import { NextResponse } from "next/server";
import { listStatsGames } from "@/lib/stats";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const page = Math.max(1, Number(searchParams.get("page") ?? "1") || 1);
    const minPlayers = Number(searchParams.get("minPlayers") ?? "");
    const data = await listStatsGames({
      page,
      q: searchParams.get("q") ?? "",
      genre: searchParams.get("genre") ?? "all",
      sort: searchParams.get("sort") ?? "playing",
      minPlayers: Number.isFinite(minPlayers) ? minPlayers : null
    });
    return NextResponse.json(data, {
      headers: {
        "cache-control": "public, max-age=60, stale-while-revalidate=300"
      }
    });
  } catch (error) {
    console.error("Failed to load stats games", error);
    return NextResponse.json({ error: "Failed to load stats games" }, { status: 500 });
  }
}
