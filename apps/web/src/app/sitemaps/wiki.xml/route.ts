import { buildSitemapUrlSetXml, toIsoDate, type SitemapUrlSetEntry, withSiteUrl } from "@/lib/sitemap";
import { listPublishedWikiPages } from "@/lib/wiki";
import { buildWikiCatalogPath, listPublishedWikiCatalogPagesByWikiSlug } from "@/lib/wiki-catalog";
import { NextResponse } from "next/server";

export const revalidate = 21600; // 6 hours

export async function GET() {
  try {
    const rows = await listPublishedWikiPages();
    const wikiPages: SitemapUrlSetEntry[] = rows
      .filter((row) => row.slug)
      .map((row) => ({
        loc: withSiteUrl(`/wiki/${row.slug}`),
        changefreq: "weekly",
        priority: "0.9",
        lastmod: toIsoDate(row.content_updated_at ?? row.updated_at ?? row.published_at ?? row.created_at)
      }));
    const catalogGroups = await Promise.all(
      rows
        .filter((row) => row.slug)
        .map((row) => listPublishedWikiCatalogPagesByWikiSlug(row.slug))
    );
    const wikiCatalogPages: SitemapUrlSetEntry[] = catalogGroups.flat().map((row) => ({
      loc: withSiteUrl(buildWikiCatalogPath(row.wiki_slug, row.collection_slug)),
      changefreq: "weekly",
      priority: "0.9",
      lastmod: toIsoDate(row.content_updated_at ?? row.updated_at ?? row.published_at ?? row.created_at)
    }));
    const pages = [...wikiPages, ...wikiCatalogPages].sort((a, b) => a.loc.localeCompare(b.loc));

    return new NextResponse(buildSitemapUrlSetXml(pages), {
      headers: { "content-type": "application/xml" }
    });
  } catch (error) {
    console.error("Failed to build wiki sitemap", error);
    return new NextResponse(buildSitemapUrlSetXml([]), {
      headers: { "content-type": "application/xml" }
    });
  }
}
