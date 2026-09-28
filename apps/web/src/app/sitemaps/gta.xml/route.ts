import { listPublishedGtaChecklists } from "@/lib/gta-checklists";
import { listGtaInteractiveMapDefinitions } from "@/lib/gta-interactive-map-registry";
import { NextResponse } from "next/server";
import {
  buildGtaCollectionPath,
  buildGtaWikiPath,
  listPublishedGtaWikiCollections,
  listPublishedGtaWikiPages
} from "@/lib/gta";
import { buildSitemapUrlSetXml, toIsoDate, type SitemapUrlSetEntry, withSiteUrl } from "@/lib/sitemap";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const fetchCache = "force-no-store";

export async function GET() {
  try {
    const [wikiPages, collections, checklistData] = await Promise.all([
      listPublishedGtaWikiPages(),
      listPublishedGtaWikiCollections(),
      listPublishedGtaChecklists(1, 1000)
    ]);
    const publishedWikiSlugs = new Set(wikiPages.map((page) => page.slug));
    const mapRoutes = [
      ...(publishedWikiSlugs.has("gta-5") ? [{ loc: withSiteUrl("/gta/maps/gta5"), changefreq: "monthly" as const, priority: "0.9" }] : []),
      ...listGtaInteractiveMapDefinitions()
        .filter((map) => publishedWikiSlugs.has(map.wikiSlug))
        .map((map) => ({ loc: withSiteUrl(map.route), changefreq: "monthly" as const, priority: "0.9" }))
    ];
    const pages: SitemapUrlSetEntry[] = [
      { loc: withSiteUrl("/games"), changefreq: "weekly", priority: "0.8" },
      { loc: withSiteUrl("/gta"), changefreq: "weekly", priority: "0.9" },
      { loc: withSiteUrl("/gta/wiki"), changefreq: "weekly", priority: "0.9" },
      ...(mapRoutes.length ? [{ loc: withSiteUrl("/gta/maps"), changefreq: "monthly" as const, priority: "0.8" }] : []),
      ...mapRoutes,
      ...(checklistData.total ? [{ loc: withSiteUrl("/gta/checklists"), changefreq: "weekly" as const, priority: "0.9" }] : []),
      ...checklistData.checklists.map(page => ({ loc: withSiteUrl(`/gta/checklists/${page.slug}`), changefreq: "weekly" as const, priority: "0.9", lastmod: toIsoDate(page.content_updated_at ?? page.updated_at) })),
      ...wikiPages.map((page) => ({
        loc: withSiteUrl(buildGtaWikiPath(page.slug)),
        changefreq: "weekly" as const,
        priority: "0.9",
        lastmod: toIsoDate(page.content_updated_at ?? page.updated_at ?? page.published_at ?? page.created_at)
      })),
      ...collections.map((page) => ({
        loc: withSiteUrl(buildGtaCollectionPath(page.wiki_slug, page.collection_slug)),
        changefreq: "weekly" as const,
        priority: "0.9",
        lastmod: toIsoDate(page.content_updated_at ?? page.updated_at ?? page.published_at ?? page.created_at)
      }))
    ];
    return new NextResponse(buildSitemapUrlSetXml(pages), { headers: { "content-type": "application/xml" } });
  } catch (error) {
    console.error("Failed to build GTA sitemap", error);
    return new NextResponse(buildSitemapUrlSetXml([]), { headers: { "content-type": "application/xml" } });
  }
}
