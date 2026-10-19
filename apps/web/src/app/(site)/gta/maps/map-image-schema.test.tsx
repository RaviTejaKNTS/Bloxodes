import { describe, expect, it, vi } from "vitest";
import { load } from "cheerio";
import { renderToStaticMarkup } from "react-dom/server";
import { getGameExtendedPage } from "@/lib/game-extra-pages";
import Gta5MapPage from "./gta5/page";
import GtaInteractiveMapPage from "./[slug]/page";
import type { GameExtendedPage } from "@/lib/game-page-data";

vi.mock("server-only", () => ({}));
vi.mock("@/components/games/GameRelatedLinks", () => ({ GameRelatedLinks: () => null }));
vi.mock("@/components/comments/CommentsSection", () => ({ CommentsSection: () => null }));
vi.mock("@/lib/game-extra-pages", () => ({ getGameExtendedPage: vi.fn() }));
vi.mock("@/lib/gta-map", () => ({ getGta5MapMarkers: async () => [] }));
vi.mock("@/components/gta/Gta5InteractiveMap", () => ({ Gta5InteractiveMap: () => null }));
vi.mock("@/components/gta/GtaInteractiveMap", () => ({ GtaInteractiveMap: () => null }));
vi.mock("@/components/gta/GtaMapGuide", () => ({ GtaMapGuide: () => null }));
vi.mock("@/lib/gta-interactive-maps", () => ({ getGtaInteractiveMapPageData: async () => ({
  config: { route: "/gta/maps/gta-3", title: "GTA 3", mapTitle: "GTA 3 Map", description: "Liberty City locations.", mappedPointCount: 0 },
  layers: [], guides: [], hubTitle: "GTA 3 Wiki", hubPath: "/gta/wiki/gta-3"
}) }));

describe("GTA map image schema", () => {
  it.each([null, "https://media.bloxodes.com/gta-cover.webp"])("both map engines only include real game artwork (%s)", async image => {
    vi.mocked(getGameExtendedPage).mockResolvedValue({ image } as GameExtendedPage);
    const maps = [await Gta5MapPage(), await GtaInteractiveMapPage({ params: Promise.resolve({ slug: "gta-3" }) })];
    for (const map of maps) {
      const $ = load(renderToStaticMarkup(map));
      const schema = JSON.parse($("script[type='application/ld+json']").text())["@graph"][0];
      if (image) expect(schema.image).toBe(image);
      else expect(schema).not.toHaveProperty("image");
    }
  });
});
