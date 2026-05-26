import { NextResponse } from "next/server";
import { buildSitemapUrlSetXml, toIsoDate, type SitemapUrlSetEntry, withSiteUrl } from "@/lib/sitemap";
import { listPuzzleSitemapEntries } from "@/lib/puzzles";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const fetchCache = "force-no-store";

export async function GET() {
  try {
    const entries = await listPuzzleSitemapEntries();
    const pages: SitemapUrlSetEntry[] = entries.map((entry) => ({
      loc: withSiteUrl(`/puzzles/${entry.slug}`),
      changefreq: "daily",
      priority: "0.8",
      lastmod: toIsoDate(entry.updatedAt)
    }));

    return new NextResponse(buildSitemapUrlSetXml(pages), {
      headers: { "content-type": "application/xml" }
    });
  } catch (error) {
    console.error("Failed to build puzzles sitemap", error);
    return new NextResponse(buildSitemapUrlSetXml([]), {
      headers: { "content-type": "application/xml" }
    });
  }
}
