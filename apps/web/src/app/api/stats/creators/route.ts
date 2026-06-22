import { NextResponse } from "next/server";
import { listStatsCreators } from "@/lib/stats";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const page = Math.max(1, Number(searchParams.get("page") ?? "1") || 1);
    const data = await listStatsCreators({
      page,
      q: searchParams.get("q") ?? "",
      sort: searchParams.get("sort") ?? "playing",
      creatorType: searchParams.get("type") ?? "all"
    });
    return NextResponse.json(data, {
      headers: {
        "cache-control": "public, max-age=60, stale-while-revalidate=300"
      }
    });
  } catch (error) {
    console.error("Failed to load stats creators", error);
    return NextResponse.json({ error: "Failed to load stats creators" }, { status: 500 });
  }
}
