import { buildSitemapUrlSetXml, toIsoDate, type SitemapUrlSetEntry, withSiteUrl } from "@/lib/sitemap";
import { listPublishedWikiPages } from "@/lib/wiki";
import { buildWikiCollectionPath, listPublishedWikiCollectionPages } from "@/lib/wiki-collections";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const fetchCache = "force-no-store";

export async function GET() {
  try {
    const [rows, collectionRows] = await Promise.all([
      listPublishedWikiPages(),
      listPublishedWikiCollectionPages()
    ]);
    const wikiPages: SitemapUrlSetEntry[] = rows
      .filter((row) => row.slug)
      .map((row) => ({
        loc: withSiteUrl(`/wiki/${row.slug}`),
        changefreq: "weekly",
        priority: "0.9",
        lastmod: toIsoDate(row.content_updated_at ?? row.updated_at ?? row.published_at ?? row.created_at)
      }));
    const wikiCollectionPages = collectionRows.map((row) => ({
      loc: withSiteUrl(buildWikiCollectionPath(row.wiki_slug, row.collection_slug)),
      changefreq: "weekly",
      priority: "0.9",
      lastmod: toIsoDate(row.content_updated_at ?? row.updated_at ?? row.published_at ?? row.created_at)
    }));
    const pages = [...wikiPages, ...wikiCollectionPages].sort((a, b) => a.loc.localeCompare(b.loc));

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
