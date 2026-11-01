import { NextResponse } from "next/server";
import { getGameMenuForPath } from "@/lib/game-site-data";
import { readGameIndexPaths } from "@/lib/site-route-snapshot";

export const dynamic = "force-dynamic";

/** Only published game paths can ask for a game menu. Never query menus for Roblox. */
export async function GET(request: Request) {
  const path = (new URL(request.url).searchParams.get("path") ?? "").replace(/\/page\/[1-9]\d*$/, "");
  try {
    const paths = await readGameIndexPaths(undefined, true);
    const menu = paths.has(path) || /^\/games\/[^/]+$/.test(path) ? await getGameMenuForPath(path) : null;
    return NextResponse.json({ menu }, { headers: { "Cache-Control": "public, max-age=60, s-maxage=60" } });
  } catch {
    return NextResponse.json({ menu: null }, { headers: { "Cache-Control": "no-store" } });
  }
}
