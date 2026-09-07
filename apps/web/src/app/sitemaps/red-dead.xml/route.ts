import { NextResponse } from "next/server";
import {
  buildRedDeadCollectionPath,
  buildRedDeadWikiPath,
  listPublishedRedDeadWikiCollections,
  listPublishedRedDeadWikiPages
} from "@/lib/red-dead";
import { buildSitemapUrlSetXml, toIsoDate, type SitemapUrlSetEntry, withSiteUrl } from "@/lib/sitemap";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const fetchCache = "force-no-store";

function rowLastmod(row: { content_updated_at?: string | null; updated_at?: string | null; published_at?: string | null; created_at?: string | null }) {
  return toIsoDate(
    row.content_updated_at ?? row.updated_at ?? row.published_at ?? row.created_at
  );
}

export async function GET() {
  try {
    const [wikiPages, collections] = await Promise.all([
      listPublishedRedDeadWikiPages(),
      listPublishedRedDeadWikiCollections()
    ]);

    const pages: SitemapUrlSetEntry[] = [
      { loc: withSiteUrl("/games"), changefreq: "weekly", priority: "0.8" },
      { loc: withSiteUrl("/red-dead"), changefreq: "weekly", priority: "0.9" },
      { loc: withSiteUrl("/red-dead/wiki"), changefreq: "weekly", priority: "0.9" },
      ...wikiPages.map((page) => ({
        loc: withSiteUrl(buildRedDeadWikiPath(page.slug)),
        changefreq: "weekly" as const,
        priority: "0.9" as const,
        lastmod: rowLastmod(page)
      })),
      ...collections.map((page) => ({
        loc: withSiteUrl(buildRedDeadCollectionPath(page.wiki_slug, page.collection_slug)),
        changefreq: "weekly" as const,
        priority: "0.9" as const,
        lastmod: rowLastmod(page)
      }))
    ];

    return new NextResponse(buildSitemapUrlSetXml(pages), { headers: { "content-type": "application/xml" } });
  } catch (error) {
    console.error("Failed to build Red Dead sitemap", error);
    return new NextResponse(buildSitemapUrlSetXml([]), { headers: { "content-type": "application/xml" } });
  }
}
