import { NextResponse } from "next/server";
import { getCatalogTopNavContext } from "@/lib/catalog-top-nav";
import { getGameTopNavContext } from "@/lib/game-top-nav";

export const dynamic = "force-dynamic";

function normalizePath(value: string | null): string | null {
  const normalized = (value ?? "").trim();
  if (!normalized || normalized.length > 500 || !normalized.startsWith("/")) return null;
  return normalized;
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const path = normalizePath(url.searchParams.get("path"));
  if (!path) {
    return NextResponse.json({ gameNav: null, catalogNav: null });
  }

  const [gameNav, catalogNav] = await Promise.all([getGameTopNavContext(path), getCatalogTopNavContext(path)]);
  return NextResponse.json(
    { gameNav, catalogNav },
    {
      headers: {
        "Cache-Control": "no-store"
      }
    }
  );
}
