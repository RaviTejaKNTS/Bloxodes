import { buildSitemapIndexXml, withSiteUrl } from "@/lib/sitemap";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const fetchCache = "force-no-store";

const SITEMAP_PATHS = [
  // Temporary moved-URL recrawl sitemap; remove on 2027-01-02.
  "/sitemaps/moved.xml",
  "/sitemaps/main.xml",
  "/sitemaps/codes.xml",
  "/sitemaps/articles.xml",
  "/sitemaps/tools.xml",
  "/sitemaps/checklists.xml",
  "/sitemaps/quizzes.xml",
  "/sitemaps/puzzles.xml",
  "/sitemaps/wiki.xml",
  "/sitemaps/games.xml",
  "/sitemaps/events.xml",
  "/sitemaps/authors.xml",
  "/sitemaps/catalog.xml",
  "/sitemaps/stats.xml"
];

export async function GET() {
  const entries = SITEMAP_PATHS.map((path) => ({
    loc: withSiteUrl(path)
  }));
  const xml = buildSitemapIndexXml(entries);
  return new NextResponse(xml, {
    headers: { "content-type": "application/xml" }
  });
}
