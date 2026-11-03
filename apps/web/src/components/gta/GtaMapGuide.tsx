import type { ReactNode } from "react";
import { HubsSidebarLayout } from "@/components/hubs/HubsSidebar";
import { MAP_GUIDE_ID } from "@/components/gta/map-guide-id";
import { listGameMapPages } from "@/lib/game-extra-pages";
import { listGtaInteractiveMapDefinitions } from "@/lib/gta-interactive-map-registry";
import "@/styles/article-content.css";

const GTA5_MAP = { slug: "gta5", href: "/gta/maps/gta5", title: "GTA V Story Mode" };

/**
 * The map and its guide share one main column beside the ad rail.
 * Interactive map state stays outside the stable #article-body stream.
 */
export async function GtaMapGuide({ canonicalPath, title, heading, map, children }: { canonicalPath: string; title: string; heading: string; map: ReactNode; children: ReactNode }) {
  const published = new Map((await listGameMapPages("gta")).map(page => [page.slug, page]));
  // Keep the rail short so the sticky ad begins beside the map.
  const maps = [GTA5_MAP, ...listGtaInteractiveMapDefinitions().map(map => ({ slug: map.slug, href: map.route, title: map.title }))]
    .filter(map => published.has(map.slug))
    .map(map => ({ ...map, href: published.get(map.slug)!.canonical_path }))
    .filter(map => map.href !== canonicalPath).slice(0, 3);
  return (
    <div className="gta-map-guide">
      <HubsSidebarLayout canonicalPath={canonicalPath} title={title} shareHeading="Share this map with your friends" analytics={{ contentType: "gta_map", itemId: canonicalPath }} heading="More GTA maps" links={maps} footer={{ href: canonicalPath.startsWith("/maps/") ? "/games/gta" : "/gta/maps", label: "All GTA maps" }} className="content-sidebar-grid--prose">
        {map}
        <section id={MAP_GUIDE_ID} tabIndex={-1} aria-labelledby={`${MAP_GUIDE_ID}-heading`} className="mt-8 scroll-mt-24 space-y-6 outline-none">
          <h2 id={`${MAP_GUIDE_ID}-heading`} className="text-2xl font-semibold text-foreground sm:text-3xl">{heading}</h2>
          <section id="article-body" itemProp="articleBody" className="article-content prose dark:prose-invert max-w-none game-copy gta-map-guide__body journey-content-stream journey-content-stream--prose">
            {children}
          </section>
        </section>
      </HubsSidebarLayout>
    </div>
  );
}
