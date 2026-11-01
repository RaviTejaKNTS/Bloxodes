import { getGameLandingForLinks, gameLandingSitemapEntries } from "@/lib/game-landing";
import { listPublishedGtaChecklists } from "@/lib/gta-checklists";
import { listGameMapPages } from "@/lib/game-extra-pages";
import { NextResponse } from "next/server";
import {
  listPublishedGtaWikiCollections,
  listPublishedGtaWikiPages
} from "@/lib/gta";
import { buildSitemapUrlSetXml, toIsoDate, type SitemapUrlSetEntry, withSiteUrl } from "@/lib/sitemap";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const fetchCache = "force-no-store";

export async function GET() {
  try {
    const [wikiPages, collections, checklistData, maps, landing] = await Promise.all([
      listPublishedGtaWikiPages(),
      listPublishedGtaWikiCollections(),
      listPublishedGtaChecklists(1, 1000),
      listGameMapPages("gta"),
      getGameLandingForLinks("gta")
    ]);
    const mapRoutes = maps.map(page => ({ loc: withSiteUrl(page.canonical_path),
      changefreq: "monthly" as const, priority: "0.9", lastmod: toIsoDate(page.updated_at) }));
    const pages: SitemapUrlSetEntry[] = [
      ...(landing.root?.url_style !== "page_type" ? [{ loc: withSiteUrl("/games"), changefreq: "weekly" as const, priority: "0.8" }] : []),
      ...gameLandingSitemapEntries(landing),
      ...(mapRoutes.length && landing.root?.url_style !== "page_type" ? [{ loc: withSiteUrl("/gta/maps"), changefreq: "monthly" as const, priority: "0.8" }] : []),
      ...mapRoutes,
      ...(checklistData.total && landing.root?.url_style !== "page_type" ? [{ loc: withSiteUrl("/gta/checklists"), changefreq: "weekly" as const, priority: "0.9" }] : []),
      ...checklistData.checklists.map(page => ({ loc: withSiteUrl(page.canonical_path), changefreq: "weekly" as const, priority: "0.9", lastmod: toIsoDate(page.content_updated_at ?? page.updated_at) })),
      ...wikiPages.map((page) => ({
        loc: withSiteUrl(page.canonical_path),
        changefreq: "weekly" as const,
        priority: "0.9",
        lastmod: toIsoDate(page.content_updated_at ?? page.updated_at ?? page.published_at ?? page.created_at)
      })),
      ...collections.map((page) => ({
        loc: withSiteUrl(page.canonical_path),
        changefreq: "weekly" as const,
        priority: "0.9",
        lastmod: toIsoDate(page.content_updated_at ?? page.updated_at ?? page.published_at ?? page.created_at)
      }))
    ];
    return new NextResponse(buildSitemapUrlSetXml([...new Map(pages.map(page => [page.loc, page])).values()]), { headers: { "content-type": "application/xml" } });
  } catch (error) {
    console.error("Failed to build GTA sitemap", error);
    return new NextResponse(buildSitemapUrlSetXml([]), { headers: { "content-type": "application/xml" } });
  }
}
