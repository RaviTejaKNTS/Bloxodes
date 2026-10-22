import { describe, expect, it, vi } from "vitest";
import { load } from "cheerio";
import { renderToStaticMarkup } from "react-dom/server";
import { renderGameCollectibleCollectionPage } from "./GameCollectibleCollectionPage";
import type { SharedGameWikiCollectionPage } from "@/lib/shared-game-reader";
import type { GameCollectionRenderConfig } from "@/lib/game-collections";
import type { GameCollectionDataset } from "@/app/(site)/wiki/collections/games/generic";

vi.mock("server-only", () => ({}));
vi.mock("./GameCollectibleChecklist", () => ({ GameCollectibleChecklist: () => null }));
vi.mock("@/components/comments/CommentsSection", () => ({ CommentsSection: () => null }));

describe("collectible canonical breadcrumbs", () => {
  it.each([
    { landingPath: "/example/wiki", wikiPath: "/example/wiki" },
    { landingPath: "/example/wiki", wikiPath: "/example/wiki/child" },
    { landingPath: "/example", wikiPath: "/example/wiki/child" }
  ])("keeps visible and structured ancestors aligned for $landingPath and $wikiPath", ({ landingPath, wikiPath }) => {
    const canonicalPath = `${wikiPath}/items`;
    const page = { namespace: "example", canonical_path: canonicalPath } as SharedGameWikiCollectionPage;
    const $ = load(renderToStaticMarkup(renderGameCollectibleCollectionPage({
      page, namespaceTitle: "Example", wikiPath, landingPath,
      config: { code: "items", label: "Items", gameName: "Example" } as GameCollectionRenderConfig,
      dataset: { meta: null, columns: [], items: [] } satisfies GameCollectionDataset,
      groupedSections: [], contentHtml: null, collectionOptions: []
    })));
    const breadcrumbs = JSON.parse($("script[type='application/ld+json']").text())["@graph"][1].itemListElement;
    const visibleNames = $("nav[aria-label='Breadcrumb'] li").map((_index, element) => $(element).children().first().text()).get();
    const visibleUrls = $("nav[aria-label='Breadcrumb'] a").map((_index, element) => {
      const path = $(element).attr("href");
      return path === "/" ? "https://bloxodes.com" : `https://bloxodes.com${path}`;
    }).get();
    expect(breadcrumbs.map((item: { name: string }) => item.name)).toEqual(visibleNames);
    expect(breadcrumbs.map((item: { item: string }) => item.item)).toEqual([...visibleUrls, `https://bloxodes.com${canonicalPath}`]);
    expect(new Set(visibleUrls).size).toBe(visibleUrls.length);
    expect(visibleUrls).not.toContain(`https://bloxodes.com${canonicalPath}`);
    expect(visibleUrls).toContain(`https://bloxodes.com${landingPath}`);
  });
});
