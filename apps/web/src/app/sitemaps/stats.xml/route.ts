import { buildSitemapUrlSetXml, toIsoDate, type SitemapUrlSetEntry, withSiteUrl } from "@/lib/sitemap";
import { getStatsGenreOptions, listStatsGamesIndexPaths, listStatsSitemapGames } from "@/lib/stats";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const fetchCache = "force-no-store";

export async function GET() {
  const pages: SitemapUrlSetEntry[] = [
    { loc: withSiteUrl("/stats"), changefreq: "hourly", priority: "0.8" },
    { loc: withSiteUrl("/stats/roblox-platform"), changefreq: "hourly", priority: "0.8" },
    { loc: withSiteUrl("/stats/games"), changefreq: "hourly", priority: "0.8" },
    { loc: withSiteUrl("/stats/creators"), changefreq: "hourly", priority: "0.8" },
    { loc: withSiteUrl("/stats/items"), changefreq: "hourly", priority: "0.8" }
  ];

  try {
    const genres = await getStatsGenreOptions();
    pages.push(...listStatsGamesIndexPaths(genres)
      .filter((path) => path !== "/stats/games")
      .map((path) => ({
        loc: withSiteUrl(path),
        changefreq: "hourly" as const,
        priority: "0.7"
      })));

    const games = await listStatsSitemapGames(1000);
    pages.push(...games.map((game) => ({
      loc: withSiteUrl(`/stats/games/${game.slug}`),
      changefreq: "hourly",
      priority: "0.7",
      lastmod: toIsoDate(game.updatedAt)
    })));
  } catch (error) {
    console.error("Failed to build stats sitemap", error);
  }

  return new NextResponse(buildSitemapUrlSetXml(pages), {
    headers: { "content-type": "application/xml" }
  });
}
