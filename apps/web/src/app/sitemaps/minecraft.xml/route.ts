import { getGameLandingForLinks, gameLandingSitemapEntries } from "@/lib/game-landing";
import { NextResponse } from "next/server";
import { listPublishedMinecraftWikiPages, listPublishedMinecraftCollections, listPublishedMinecraftTools } from "@/lib/minecraft";
import { buildSitemapUrlSetXml, toIsoDate, type SitemapUrlSetEntry, withSiteUrl } from "@/lib/sitemap";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const fetchCache = "force-no-store";

function rowLastmod(row: { content_updated_at?: string | null; updated_at?: string | null; published_at?: string | null; created_at?: string | null }) {
  return toIsoDate(row.content_updated_at ?? row.updated_at ?? row.published_at ?? row.created_at);
}

export async function GET() {
  try {
    const [wikis, collections, tools, landing] = await Promise.all([
      listPublishedMinecraftWikiPages(), listPublishedMinecraftCollections(), listPublishedMinecraftTools(), getGameLandingForLinks("minecraft")
    ]);
    const pages: SitemapUrlSetEntry[] = [];
    pages.push(...gameLandingSitemapEntries(landing));
    for (const wiki of wikis.filter(page => page.slug !== "minecraft")) pages.push({ loc: withSiteUrl(wiki.canonical_path), changefreq: "weekly", priority: "0.9", lastmod: rowLastmod(wiki) });
    for (const page of collections) pages.push({ loc: withSiteUrl(page.canonical_path), changefreq: "weekly", priority: "0.8", lastmod: rowLastmod(page) });
    for (const page of tools) pages.push({ loc: withSiteUrl(page.canonical_path), changefreq: "weekly", priority: "0.8", lastmod: rowLastmod(page) });
    return new NextResponse(buildSitemapUrlSetXml([...new Map(pages.map(page => [page.loc, page])).values()]), { headers: { "content-type": "application/xml" } });
  } catch (error) {
    console.error("Failed to build Minecraft sitemap", error);
    return new NextResponse("Minecraft sitemap temporarily unavailable", { status: 503, headers: { "Retry-After": "60" } });
  }
}
