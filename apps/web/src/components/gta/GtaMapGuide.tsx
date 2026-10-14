import type { ReactNode } from "react";
import { HubsSidebarLayout } from "@/components/hubs/HubsSidebar";
import { MAP_GUIDE_ID } from "@/components/gta/map-guide-id";
import { listGameMapPages } from "@/lib/game-extra-pages";
import { listGtaInteractiveMapDefinitions } from "@/lib/gta-interactive-map-registry";
import "@/styles/article-content.css";

const GTA5_MAP = { slug: "gta5", href: "/gta/maps/gta5", title: "GTA V Story Mode" };

/**
 * The map guide under a full-screen GTA map: the copy that used to sit in the hidden About panel,
 * as the page's #article-body, plus the right rail. The map itself stays outside #article-body.
 */
export async function GtaMapGuide({ canonicalPath, title, heading, children }: { canonicalPath: string; title: string; heading: string; children: ReactNode }) {
  const published = new Set((await listGameMapPages("gta")).map(page => page.slug));
  // Titles only: the rail starts below the full-screen map, so keep it short for the sticky ads.
  const maps = [GTA5_MAP, ...listGtaInteractiveMapDefinitions().map(map => ({ slug: map.slug, href: map.route, title: map.title }))]
    .filter(map => published.has(map.slug));
  return (
    <div className="gta-map-guide">
      <HubsSidebarLayout canonicalPath={canonicalPath} title={title} shareHeading="Share this map with your friends" analytics={{ contentType: "gta_map", itemId: canonicalPath }} heading="More GTA maps" links={maps} footer={{ href: "/gta/maps", label: "All GTA maps" }} className="content-sidebar-grid--prose">
        <section id={MAP_GUIDE_ID} tabIndex={-1} aria-labelledby={`${MAP_GUIDE_ID}-heading`} className="scroll-mt-24 space-y-6 outline-none">
          <h2 id={`${MAP_GUIDE_ID}-heading`} className="text-2xl font-semibold text-foreground sm:text-3xl">{heading}</h2>
          <div id="article-body" itemProp="articleBody" className="article-content prose dark:prose-invert max-w-none game-copy gta-map-guide__body">
            {children}
          </div>
        </section>
      </HubsSidebarLayout>
    </div>
  );
}
