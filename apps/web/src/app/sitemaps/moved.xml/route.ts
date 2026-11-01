import { NextResponse } from "next/server";
import { movedGameSitemapEntries } from "@/lib/moved-game-sitemap";
import { buildSitemapUrlSetXml } from "@/lib/sitemap";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const fetchCache = "force-no-store";

export async function GET() {
  try {
    return new NextResponse(buildSitemapUrlSetXml(await movedGameSitemapEntries()), {
      headers: { "content-type": "application/xml" }
    });
  } catch {
    return new NextResponse("Moved game sitemap temporarily unavailable", {
      status: 503, headers: { "Retry-After": "60" }
    });
  }
}
