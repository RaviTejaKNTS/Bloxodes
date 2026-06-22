import { NextResponse } from "next/server";
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

  try {
    const gameNav = await getGameTopNavContext(path);
    return NextResponse.json(
      { gameNav, catalogNav: null },
      {
        headers: {
          "Cache-Control": "no-store"
        }
      }
    );
  } catch (error) {
    console.error("Failed to load game top nav", error);
    return NextResponse.json(
      { gameNav: null, catalogNav: null },
      {
        headers: {
          "Cache-Control": "no-store"
        }
      }
    );
  }
}
