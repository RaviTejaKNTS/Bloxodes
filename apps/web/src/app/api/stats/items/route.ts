import { NextResponse } from "next/server";
import { listStatsItems } from "@/lib/stats";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const page = Math.max(1, Number(searchParams.get("page") ?? "1") || 1);
    const data = await listStatsItems({
      page,
      q: searchParams.get("q") ?? "",
      sort: searchParams.get("sort") ?? "favorites",
      category: searchParams.get("category") ?? "",
      subcategory: searchParams.get("subcategory") ?? "",
      sale: searchParams.get("sale") ?? "all",
      creator: searchParams.get("creator") ?? "all"
    });
    return NextResponse.json(data, {
      headers: {
        "cache-control": "public, max-age=60, stale-while-revalidate=300"
      }
    });
  } catch (error) {
    console.error("Failed to load stats items", error);
    return NextResponse.json({ error: "Failed to load stats items" }, { status: 500 });
  }
}
