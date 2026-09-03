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
    const [wikiPages, collections] = await Promise.all([
      listPublishedGtaWikiPages(),
      listPublishedGtaWikiCollections()
    ]);
    const pages: SitemapUrlSetEntry[] = [
      { loc: withSiteUrl("/games"), changefreq: "weekly", priority: "0.8" },
      { loc: withSiteUrl("/gta"), changefreq: "weekly", priority: "0.9" },
      { loc: withSiteUrl("/gta/wiki"), changefreq: "weekly", priority: "0.9" },
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
