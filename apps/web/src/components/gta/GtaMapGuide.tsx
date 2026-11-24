import type { ReactNode } from "react";
import { MapGuideLayout } from "@/components/maps/MapGuideLayout";
import { listGameMapPages } from "@/lib/game-extra-pages";
import { listGtaInteractiveMapDefinitions } from "@/lib/gta-interactive-map-registry";

const GTA5_MAP = { slug: "gta5", href: "/gta/maps/gta5", title: "GTA V Story Mode" };

/** The registered GTA maps' guide: the shared map layout with a rail of other GTA maps. */
export async function GtaMapGuide({ canonicalPath, title, heading, map, children }: { canonicalPath: string; title: string; heading: string; map: ReactNode; children: ReactNode }) {
  const published = new Map((await listGameMapPages("gta")).map(page => [page.slug, page]));
  // Keep the rail short so the sticky ad begins beside the map.
  const maps = [GTA5_MAP, ...listGtaInteractiveMapDefinitions().map(map => ({ slug: map.slug, href: map.route, title: map.title }))]
    .filter(map => published.has(map.slug))
    .map(map => ({ ...map, href: published.get(map.slug)!.canonical_path }))
    .filter(map => map.href !== canonicalPath).slice(0, 3);
  return MapGuideLayout({
    canonicalPath, title, heading, map, children,
    analytics: { contentType: "gta_map", itemId: canonicalPath },
    rail: { heading: "More GTA maps", links: maps, footer: { href: canonicalPath.startsWith("/maps/") ? "/games/gta" : "/gta/maps", label: "All GTA maps" } }
  });
}
