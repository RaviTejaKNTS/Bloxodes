import { NextResponse } from "next/server";
import { listStatsGames } from "@/lib/stats";

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

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const page = Math.max(1, Number(searchParams.get("page") ?? "1") || 1);
    const data = await listStatsGames({
      page,
      q: searchParams.get("q") ?? "",
      genres: searchParams.getAll("genre"),
      subgenres: searchParams.getAll("subgenre"),
      sort: searchParams.get("sort") ?? "playing"
    });
    return NextResponse.json(data, { headers: RESPONSE_HEADERS });
  } catch (error) {
    console.error("Failed to load mobile stats games", error);
    return NextResponse.json({ error: "Failed to load stats games" }, { status: 500, headers: RESPONSE_HEADERS });
  }
}
