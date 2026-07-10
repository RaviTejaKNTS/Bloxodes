import { buildSitemapUrlSetXml, toIsoDate, type SitemapUrlSetEntry, withSiteUrl } from "@/lib/sitemap";
import {
  getStatsGamesSeoTaxonomy,
  getStatsSitemapLastModifiedTimes,
  listStatsGamesIndexPaths,
  listStatsSitemapGames
} from "@/lib/stats";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const fetchCache = "force-no-store";

export async function GET() {
  const pages: SitemapUrlSetEntry[] = [
    { loc: withSiteUrl("/stats"), changefreq: "hourly", priority: "0.8" },
    { loc: withSiteUrl("/stats/roblox-platform"), changefreq: "hourly", priority: "0.8" },
    { loc: withSiteUrl("/stats/creators"), changefreq: "hourly", priority: "0.8" },
    { loc: withSiteUrl("/stats/items"), changefreq: "hourly", priority: "0.8" }
  ];

  try {
    const [taxonomy, lastModified, games] = await Promise.all([
      getStatsGamesSeoTaxonomy(),
      getStatsSitemapLastModifiedTimes(),
      listStatsSitemapGames(1000)
    ]);
    pages[0].lastmod = toIsoDate(lastModified.stats);
    pages[1].lastmod = toIsoDate(lastModified.platform);
    pages[2].lastmod = toIsoDate(lastModified.creators);
    pages[3].lastmod = toIsoDate(lastModified.items);
    pages.push(...listStatsGamesIndexPaths(taxonomy.genres, taxonomy.subgenres)
      .map((path) => ({
        loc: withSiteUrl(path),
        changefreq: "hourly" as const,
        priority: path === "/stats/games" ? "0.8" : "0.7",
        lastmod: toIsoDate(lastModified.games)
      })));

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
