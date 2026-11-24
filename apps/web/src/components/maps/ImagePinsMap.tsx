"use client";

import { useMemo } from "react";
import { escapeHtml, InteractiveImageMap, type InteractiveMapCredit, type InteractiveMapData } from "@/components/maps/InteractiveImageMap";

/** The shared `image-pins` engine: the map's own attribution, no collection progress. */
export function ImagePinsMap({ map, attribution }: { map: InteractiveMapData; attribution: string }) {
  const credit = useMemo<InteractiveMapCredit>(() => ({
    attributionHtml: () => escapeHtml(attribution),
    pointSource: () => attribution
  }), [attribution]);
  return <InteractiveImageMap map={map} credit={credit} />;
}
