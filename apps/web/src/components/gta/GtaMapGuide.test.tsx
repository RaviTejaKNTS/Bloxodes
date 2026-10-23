import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { load } from "cheerio";
import { GtaMapGuide } from "./GtaMapGuide";
import { MapViewport } from "@/components/maps/MapViewport";
vi.mock("@/lib/game-extra-pages", () => ({ listGameMapPages: async () => [{ slug: "gta5" }, { slug: "gta-san-andreas" }] }));

describe("GTA map ad layout", () => {
  it("renders one rail beside the map and flat guide copy, with full screen available", async () => {
    const $ = load(renderToStaticMarkup(await GtaMapGuide({ canonicalPath: "/gta/maps/gta5", title: "GTA 5 map", heading: "About this map", map: <MapViewport><div data-map-engine /></MapViewport>, children: <><p>First paragraph.</p><p>Second paragraph.</p><h3>Collection guides</h3><ul><li>Parts</li></ul></> })));
    expect($("#article-body")).toHaveLength(1);
    expect($(".content-sidebar-grid > aside#sidebar.space-y-4")).toHaveLength(1);
    expect($("#article-body > p")).toHaveLength(2);
    expect($("#article-body [data-map-engine]")).toHaveLength(0);
    expect($(".content-sidebar-grid > .hubs-main [data-map-engine]")).toHaveLength(1);
    expect($(".map-viewport-toolbar button").text()).toBe("Full screen");
    expect($("#sidebar .gta-map-app")).toHaveLength(0);
  });
});
