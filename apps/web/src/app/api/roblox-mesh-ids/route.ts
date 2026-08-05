import { NextResponse } from "next/server";
import {
  loadRobloxMeshIdsPageData
} from "@/lib/roblox-mesh-ids";
import { normalizeMeshSearch, normalizeMeshSort } from "@/lib/roblox-mesh-ids-search";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const rawPage = searchParams.get("page") ?? "1";
  if (!/^\d+$/.test(rawPage)) {
    return NextResponse.json({ ok: false, error: "Invalid page" }, { status: 400 });
  }
  const page = Number.parseInt(rawPage, 10);
  if (page < 1 || page > 1_000) {
    return NextResponse.json({ ok: false, error: "Invalid page" }, { status: 400 });
  }
  const pageData = await loadRobloxMeshIdsPageData(page, {
    query: normalizeMeshSearch(searchParams.get("q")),
    sort: normalizeMeshSort(searchParams.get("sort"))
  });
  return NextResponse.json(
    { ok: true, ...pageData },
    { headers: { "Cache-Control": "public, max-age=60, s-maxage=3600, stale-while-revalidate=86400" } }
  );
}
