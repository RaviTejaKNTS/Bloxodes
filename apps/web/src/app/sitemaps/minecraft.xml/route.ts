import { NextResponse } from "next/server";
import { buildMinecraftWikiPath, buildMinecraftCollectionPath, listPublishedMinecraftWikiPages, listPublishedMinecraftCollections, listPublishedMinecraftTools } from "@/lib/minecraft";
import { buildSitemapUrlSetXml, toIsoDate, type SitemapUrlSetEntry, withSiteUrl } from "@/lib/sitemap";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const fetchCache = "force-no-store";

function rowLastmod(row: { content_updated_at?: string | null; updated_at?: string | null; published_at?: string | null; created_at?: string | null }) {
  return toIsoDate(row.content_updated_at ?? row.updated_at ?? row.published_at ?? row.created_at);
}

export async function GET() {
  try {
    const [wikis, collections, tools] = await Promise.all([
      listPublishedMinecraftWikiPages(), listPublishedMinecraftCollections(), listPublishedMinecraftTools()
    ]);
    const pages: SitemapUrlSetEntry[] = [];
    pages.push(
      { loc: withSiteUrl("/minecraft"), changefreq: "weekly", priority: "0.9", lastmod: rowLastmod(wikis[0] ?? {}) },
      { loc: withSiteUrl("/minecraft/wiki"), changefreq: "weekly", priority: "0.9", lastmod: rowLastmod(wikis[0] ?? {}) }
    );
    for (const wiki of wikis.filter(page => page.slug !== "minecraft")) pages.push({ loc: withSiteUrl(buildMinecraftWikiPath(wiki.slug)), changefreq: "weekly", priority: "0.9", lastmod: rowLastmod(wiki) });
    if (tools.length) pages.push({ loc: withSiteUrl("/minecraft/tools"), changefreq: "weekly", priority: "0.8" });
    for (const page of collections) pages.push({ loc: withSiteUrl(buildMinecraftCollectionPath(page.wiki_slug, page.collection_slug)), changefreq: "weekly", priority: "0.8", lastmod: rowLastmod(page) });
    for (const page of tools) pages.push({ loc: withSiteUrl(`/minecraft/tools/${page.slug}`), changefreq: "weekly", priority: "0.8", lastmod: rowLastmod(page) });
    return new NextResponse(buildSitemapUrlSetXml(pages), { headers: { "content-type": "application/xml" } });
  } catch (error) {
    console.error("Failed to build Minecraft sitemap", error);
    return new NextResponse("Minecraft sitemap temporarily unavailable", { status: 503, headers: { "Retry-After": "60" } });
  }
}
