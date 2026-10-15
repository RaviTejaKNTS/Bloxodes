import type { ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { renderGameCollectionPage, type GameCollectionDataset } from "@/app/(site)/wiki/collections/games/generic";
import { renderRobloxCollectionChecklistPage } from "@/components/wiki/RobloxCollectionChecklistPage";
import type { WikiCollectionPageContent } from "@/lib/wiki-collections";

vi.mock("server-only", () => ({}));
vi.mock("react", async original => ({ ...await original<typeof import("react")>(), cache: (fn: unknown) => fn }));
vi.mock("@/components/CatalogAdSlot", () => ({ CatalogAdSlot: () => null }));
vi.mock("@/components/CatalogSelectNav", () => ({ CatalogSelectNav: () => null }));
vi.mock("@/components/game-collections/GameCollectionView", () => ({
  GameCollectionView: ({ beforeToolbar, afterContent }: { beforeToolbar?: ReactNode; afterContent?: ReactNode }) => <>{beforeToolbar}<p>Item roster</p>{afterContent}</>
}));
vi.mock("@/components/wiki/RobloxCollectionChecklist", () => ({
  RobloxCollectionChecklist: ({ beforeToolbar, afterContent }: { beforeToolbar?: ReactNode; afterContent?: ReactNode }) => <>{beforeToolbar}<p>Collectible roster</p>{afterContent}</>
}));

const config = { code: "game-pets", gameSlug: "game", gameName: "Game", slug: "pets", label: "Pets", sortOrder: 1 };
const dataset: GameCollectionDataset = { meta: null, columns: ["rarity"], items: [{ id: "cat", name: "Cat", rarity: "Common" }] };
const contentHtml = { title: "Game pets", introHtml: "<p>Pets boost your harvest.</p>", howHtml: "<p>Legacy page instructions.</p>", descriptionHtml: [{ key: "description-md", html: "<p>Equip a pet before harvesting.</p>" }], faqHtml: [], publishedAt: null, updatedAt: null, ctaLabel: null, ctaUrl: null };

describe("Roblox collection introductions", () => {
  it.each([true, false])("keeps the intro and game advice without legacy help, stream=%s", stream => {
    const html = renderToStaticMarkup(renderGameCollectionPage({ config, dataset, contentHtml, routeBase: "/wiki/", stream, collectionOptions: [], showMoreCollections: false }));
    expect(html).toContain("Pets boost your harvest.");
    expect(html).toContain("Item roster");
    expect(html).toContain("Equip a pet before harvesting.");
    expect(html).not.toContain("Legacy page instructions.");
    expect(html).not.toContain("How to use this collection");
    expect(html.indexOf("Pets boost")).toBeLessThan(html.indexOf("Item roster"));
  });

  it("preserves GTA help after the roster", () => {
    const html = renderToStaticMarkup(renderGameCollectionPage({ config, dataset, contentHtml, routeBase: "/gta/wiki", stream: true, collectionOptions: [], showMoreCollections: false }));
    expect(html).toContain("Legacy page instructions.");
    expect(html.indexOf("Item roster")).toBeLessThan(html.indexOf("Legacy page instructions."));
  });

  it("keeps collectible game advice without the old help field", () => {
    const page: WikiCollectionPageContent = {
      wiki_slug: config.gameSlug,
      collection_slug: config.slug,
      code: config.code,
      page_type: "collectible",
      title: "Game pets",
      seo_title: "Game pets",
      meta_description: "Find the pets.",
      intro_md: "Pets boost your harvest.",
      how_it_works_md: "Legacy page instructions.",
      description_json: {},
      faq_json: [],
      is_published: true
    };
    const html = renderToStaticMarkup(renderRobloxCollectionChecklistPage({ page, config, dataset, groupedSections: [{ id: "pets", label: "Pets", items: dataset.items }], contentHtml, collectionOptions: [] }));
    expect(html).toContain("Pets boost your harvest.");
    expect(html).toContain("Collectible roster");
    expect(html).toContain("Equip a pet before harvesting.");
    expect(html).not.toContain("Legacy page instructions.");
  });
});
