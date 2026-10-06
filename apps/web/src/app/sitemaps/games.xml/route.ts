import { NextResponse } from "next/server";
import { listSharedGameDiscoveryPages } from "@/lib/game-content-index";
import { buildSitemapUrlSetXml, toIsoDate, withSiteUrl } from "@/lib/sitemap";
export const dynamic = "force-dynamic";
export const revalidate = 0;
export async function GET() {
 try {
  const pages = await listSharedGameDiscoveryPages();
  const paths = new Map<string, string | undefined>();
  for(const page of pages) {
   paths.set(page.canonical_path, toIsoDate(page.updated_at ?? page.published_at ?? page.created_at));
   const namespace = page.canonical_path.split("/")[1];
   paths.set(`/${namespace}`, undefined);
   const section = page.canonical_path.split("/")[2];
   if (section === "codes" || section === "tools") paths.set(`/${namespace}/${section}`, undefined);
  }
  return new NextResponse(buildSitemapUrlSetXml([...paths].map(([path,lastmod])=>({loc:withSiteUrl(path),lastmod,changefreq:"weekly",priority:"0.8"}))),{headers:{"content-type":"application/xml"}});
 } catch(error) { console.error("Shared game sitemap failed",error); return new NextResponse("Game sitemap temporarily unavailable",{status:503,headers:{"Retry-After":"60"}}); }
}
