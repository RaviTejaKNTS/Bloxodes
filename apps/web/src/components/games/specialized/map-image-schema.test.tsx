import { describe, expect, it, vi } from "vitest";
import { load } from "cheerio";
import { renderToStaticMarkup } from "react-dom/server";
import { getGameMapBySlug } from "@/lib/game-extra-pages";
import { specializedGtaMapRoute } from "@/lib/specialized-game-route";
import { generateMetadata as gta5Metadata } from "./Gta5Map";
import Gta5MapPage from "./Gta5Map";
import GtaInteractiveMapPage from "./GtaMap";
import type { GameExtendedPage } from "@/lib/game-page-data";

vi.mock("@/lib/game-landing", () => ({ getGameLandingForLinks: async (namespace: string) => ({ path: `/${namespace}/wiki` }) }));
vi.mock("server-only", () => ({}));
vi.mock("@/components/games/GameRelatedLinks", () => ({ GameRelatedLinks: () => null }));
vi.mock("@/components/comments/CommentsSection", () => ({ CommentsSection: () => null }));
vi.mock("@/lib/game-extra-pages", () => ({ getGameMapBySlug: vi.fn() }));
vi.mock("@/lib/gta-map", () => ({ getGta5MapMarkers: async () => [] }));
vi.mock("@/components/gta/Gta5InteractiveMap", () => ({ Gta5InteractiveMap: () => null }));
vi.mock("@/components/gta/GtaInteractiveMap", () => ({ GtaInteractiveMap: () => null }));
vi.mock("@/components/gta/GtaMapGuide", () => ({ GtaMapGuide: () => null }));
vi.mock("@/lib/gta-interactive-maps", () => ({ getGtaInteractiveMapPageData: async () => ({
  config: { route: "/gta/maps/gta-3", title: "GTA 3", mapTitle: "GTA 3 Map", description: "Liberty City locations.", mappedPointCount: 0, about: [], views: [] },
  layers: [], guides: [], hubTitle: "GTA 3 Wiki", hubPath: "/gta/wiki/gta-3"
}) }));

describe("GTA map image schema", () => {
  it.each([null, "https://media.bloxodes.com/gta-cover.webp"])("both map engines only include real game artwork (%s)", async image => {
    vi.mocked(getGameMapBySlug).mockResolvedValue({ image, canonical_path: "/gta/maps/gta5" } as GameExtendedPage);
    const maps = [await Gta5MapPage(), await GtaInteractiveMapPage({ params: Promise.resolve({ slug: "gta-3" }) })];
    for (const map of maps) {
      const $ = load(renderToStaticMarkup(map));
      const schema = JSON.parse($("script[type='application/ld+json']").text())["@graph"][0];
      if (image) expect(schema.image).toBe(image);
      else expect(schema).not.toHaveProperty("image");
    }
  });
});


// The page-type dispatcher calls the same adapter. Exercise both URL styles
// against its real metadata/schema while keeping the client map out of SSR.
it.each(["/gta/maps/gta5", "/maps/gta5"])("GTA V adapter parity at %s", async canonical_path => {
  vi.mocked(getGameMapBySlug).mockResolvedValue({
    namespace: "gta", slug: "gta5", canonical_path, title: "GTA V map",
    seo_title: null, meta_description: "Map locations", image: null
  } as GameExtendedPage);
  const route = await specializedGtaMapRoute("gta", "gta5");
  expect(route).not.toBeNull();
  expect(await route!.metadata()).toEqual(await gta5Metadata());
  const original = renderToStaticMarkup(await Gta5MapPage());
  const dispatched = renderToStaticMarkup(await route!.render());
  expect(dispatched).toBe(original);
  const $ = load(dispatched);
  const schema = JSON.parse($("script[type='application/ld+json']").text());
  expect(schema["@graph"][0].url).toBe(`https://bloxodes.com${canonical_path}`);
});
