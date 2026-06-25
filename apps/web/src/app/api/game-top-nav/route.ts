import { NextResponse } from "next/server";
import { getGameTopNavContext } from "@/lib/game-top-nav";
import { CACHE_TAG_HEADER, cacheTagsForPath, serializeCacheTags } from "@/lib/public-cache-tags";

export const revalidate = 300;

const TOP_NAV_CACHE_CONTROL = "public, max-age=60, s-maxage=300, stale-while-revalidate=3600";

function responseHeaders(path: string | null) {
  const tags = path ? serializeCacheTags(["top-nav", ...cacheTagsForPath(path)]) : "top-nav";
  const headers = new Headers({
    "Cache-Control": TOP_NAV_CACHE_CONTROL
  });
  if (tags) headers.set(CACHE_TAG_HEADER, tags);
  return headers;
}

function normalizePath(value: string | null): string | null {
  const normalized = (value ?? "").trim();
  if (!normalized || normalized.length > 500 || !normalized.startsWith("/")) return null;
  return normalized;
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const path = normalizePath(url.searchParams.get("path"));
  if (!path) {
    return NextResponse.json({ gameNav: null, catalogNav: null }, { headers: responseHeaders(null) });
  }

  try {
    const gameNav = await getGameTopNavContext(path);
    return NextResponse.json(
      { gameNav, catalogNav: null },
      {
        headers: responseHeaders(path)
      }
    );
  } catch (error) {
    console.error("Failed to load game top nav", error);
    return NextResponse.json(
      { gameNav: null, catalogNav: null },
      {
        headers: responseHeaders(path)
      }
    );
  }
}
