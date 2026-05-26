import { buildSitemapUrlSetXml, toIsoDate, type SitemapUrlSetEntry, withSiteUrl } from "@/lib/sitemap";
import { listStatsSitemapGames } from "@/lib/stats";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const fetchCache = "force-no-store";

export async function GET() {
  try {
    const games = await listStatsSitemapGames(250);
    const pages: SitemapUrlSetEntry[] = [
      { loc: withSiteUrl("/stats"), changefreq: "hourly", priority: "0.8" },
      { loc: withSiteUrl("/stats/games"), changefreq: "hourly", priority: "0.8" },
      ...games.map((game) => ({
        loc: withSiteUrl(`/stats/games/${game.slug}`),
        changefreq: "hourly",
        priority: "0.7",
        lastmod: toIsoDate(game.updatedAt)
      }))
    ];

    return new NextResponse(buildSitemapUrlSetXml(pages), {
      headers: { "content-type": "application/xml" }
    });
  } catch (error) {
    console.error("Failed to build stats sitemap", error);
    return new NextResponse(buildSitemapUrlSetXml([]), {
      headers: { "content-type": "application/xml" }
    });
  }
}
