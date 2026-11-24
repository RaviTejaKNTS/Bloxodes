"use client";

import { escapeHtml, InteractiveImageMap, type InteractiveMapCredit, type InteractiveMapProgress } from "@/components/maps/InteractiveImageMap";
import type { GtaMapPageData } from "@/lib/gta-interactive-map-types";

const GTA_PROGRESS: InteractiveMapProgress = {
  endpoint: "/api/games/gta/collections/progress",
  requestKey: "code",
  storageKeyPrefix: "gta-collection:",
  eventName: "gta-collection-progress",
  analyticsPrefix: "gta_collection"
};

const GTA_CREDIT: InteractiveMapCredit = {
  attributionHtml: (view) => '<a href="' + escapeHtml(view.sourceUrl) + '" target="_blank" rel="noreferrer">GTA Wiki map data</a> · © Rockstar Games',
  pointSource: (marker) => <>Coordinates: <a href={marker.sourceUrl} target="_blank" rel="noreferrer">GTA Wiki map page</a>. Map artwork © Rockstar Games.</>
};

/** The registered `gta-layered` engine: GTA Wiki credits and GTA collection progress. */
export function GtaInteractiveMap({ map }: { map: GtaMapPageData }) {
  return <InteractiveImageMap map={map} credit={GTA_CREDIT} progress={GTA_PROGRESS} />;
}
