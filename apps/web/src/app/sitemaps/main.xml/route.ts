import { MAIN_SITEMAP_ROUTES, buildSitemapUrlSetXml, withSiteUrl } from "@/lib/sitemap";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const fetchCache = "force-no-store";

export async function GET() {
  const pages = MAIN_SITEMAP_ROUTES.map((route) => ({
    loc: withSiteUrl(route.path),
    changefreq: route.changefreq,
    priority: route.priority
  }));

  return new NextResponse(buildSitemapUrlSetXml(pages), {
    headers: { "content-type": "application/xml" }
  });
}
