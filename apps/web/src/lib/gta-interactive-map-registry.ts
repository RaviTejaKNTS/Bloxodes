import registryJson from "@/data/gta-maps/registry.json";
import type { GtaMapDefinition } from "@/lib/gta-interactive-map-types";

export const GTA_INTERACTIVE_MAPS = registryJson as GtaMapDefinition[];

export function listGtaInteractiveMapDefinitions(): GtaMapDefinition[] {
  return GTA_INTERACTIVE_MAPS;
}

export function getGtaInteractiveMapDefinition(slug: string): GtaMapDefinition | null {
  return GTA_INTERACTIVE_MAPS.find((definition) => definition.slug === slug) ?? null;
}

export function getGtaMapRouteForWikiSlug(wikiSlug: string): string | null {
  if (wikiSlug === "gta-5") return "/gta/maps/gta5";
  const definition = GTA_INTERACTIVE_MAPS.find((map) =>
    map.wikiSlug === wikiSlug
    || map.layers.some((layer) => layer.collection?.wikiSlug === wikiSlug)
    || map.guideOnly.some((guide) => guide.wikiSlug === wikiSlug)
  );
  return definition?.route ?? null;
}

export function getGtaMapRoutesForWikiSlug(wikiSlug: string): string[] {
  const paths = new Set<string>();
  const direct = getGtaMapRouteForWikiSlug(wikiSlug);
  if (direct) paths.add(direct);
  for (const definition of GTA_INTERACTIVE_MAPS) {
    if (definition.layers.some((layer) => layer.collection?.wikiSlug === wikiSlug)
      || definition.guideOnly.some((guide) => guide.wikiSlug === wikiSlug)) {
      paths.add(definition.route);
    }
  }
  return Array.from(paths);
}
