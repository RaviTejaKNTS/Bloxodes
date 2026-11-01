import { getGameLandingForLinks, gameLandingSitemapEntries } from "@/lib/game-landing";
import { getGameRoot } from "@/lib/game-registry";
import { NextResponse } from "next/server";
import { listSharedGameDiscoveryPages } from "@/lib/game-content-index";
import { buildSitemapUrlSetXml, toIsoDate, withSiteUrl } from "@/lib/sitemap";
export const dynamic = "force-dynamic";
export const revalidate = 0;
export async function GET() {
 try {
  const pages = await listSharedGameDiscoveryPages();
  const paths = new Map<string, string | undefined>();
  const namespaces = [...new Set(pages.map(page => page.namespace))];
  const roots = new Map(await Promise.all(namespaces.map(async namespace => [namespace, await getGameRoot(namespace)] as const)));
  for (const page of pages) {
   paths.set(page.canonical_path, toIsoDate(page.updated_at ?? page.published_at ?? page.created_at));
   // Namespace directories are served only by the old renderer. Moved pages
   // belong to the global indexes, which already have their own sitemap entries.
   if (roots.get(page.namespace)?.url_style === "namespace") {
    for (const section of ["codes", "tools", "maps", "quizzes", "checklists", "catalog"]) {
     const directory = `/${page.namespace}/${section}`;
     if (page.canonical_path.startsWith(`${directory}/`)) paths.set(directory, undefined);
    }
   }
  }
  for (const landing of await Promise.all(namespaces.map(getGameLandingForLinks))) {
   if (landing.isAlias && landing.root) paths.delete(`/${landing.root.namespace}`);
   for (const entry of gameLandingSitemapEntries(landing)) paths.set(new URL(entry.loc).pathname, entry.lastmod);
  }
  return new NextResponse(buildSitemapUrlSetXml([...paths].map(([path,lastmod])=>({loc:withSiteUrl(path),lastmod,changefreq:"weekly",priority:"0.8"}))),{headers:{"content-type":"application/xml"}});
 } catch(error) { console.error("Shared game sitemap failed",error); return new NextResponse("Game sitemap temporarily unavailable",{status:503,headers:{"Retry-After":"60"}}); }
}
