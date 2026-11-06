import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, expect, it, vi } from "vitest";
import { load } from "cheerio";

const navigation = vi.hoisted(() => ({ segments: [] as string[] }));
vi.mock("server-only", () => ({}));
vi.mock("next/navigation", () => ({ useSelectedLayoutSegments: () => navigation.segments }));
vi.mock("@/lib/db", () => ({ listAuthors: async () => [], listPublishedChecklistsPage: vi.fn() }));
vi.mock("@/components/catalog/CatalogSidebarContent", () => ({ CatalogSidebarContent: () => <p>Catalog links</p> }));

import AuthorsIndexPage from "@/app/(site)/authors/page";
import CatalogLayout from "@/app/(site)/catalog/layout";
import { renderChecklistsPage } from "@/app/(site)/checklists/page-data";
import { ChecklistIndexPage } from "@/components/checklists/ChecklistIndexPage";
import { ROBLOX_CHECKLISTS } from "@/lib/engagement/config";

beforeEach(() => { navigation.segments = []; });

it("renders the authors index without a rail or popular links", async () => {
  const html = renderToStaticMarkup(await AuthorsIndexPage());
  expect(html).not.toContain("<aside");
  expect(html).not.toContain("Popular pages");
  expect(load(html)("#article-body.journey-content-stream--index")).toHaveLength(1);
});

it("renders the catalog index without the rail or its main-column grid cap", () => {
  const html = renderToStaticMarkup(<CatalogLayout><p>Catalog index</p></CatalogLayout>);
  expect(html).not.toContain("<aside");
  expect(html).not.toContain("catalog-main");
  expect(html).not.toContain("Catalog links");
});

it.each([["roblox-music-ids"], ["roblox-music-ids", "page", "2"], ["example-catalog"]])("retains the catalog rail below %s", (...segments) => {
  navigation.segments = segments;
  const $ = load(renderToStaticMarkup(<CatalogLayout><p>Catalog content</p></CatalogLayout>));
  expect($(".content-sidebar-grid > aside#sidebar.space-y-4")).toHaveLength(1);
  expect($(".catalog-main")).toHaveLength(1);
});

it.each([1, 2])("renders checklist index page %i without a rail or its main-column grid cap", currentPage => {
  const html = renderToStaticMarkup(renderChecklistsPage({ cards: [], total: 0, totalPages: 2, currentPage, showHero: currentPage === 1 }));
  expect(html).not.toContain("<aside");
  const $ = load(html);
  expect($(".checklists-index-main")).toHaveLength(0);
  expect($("#article-body.journey-content-stream--index")).toHaveLength(1);
  expect($("a[href='/checklists/page/2'], a[href='/checklists']").length).toBeGreaterThan(0);
});

it("preserves the shared checklist template's rail by default for other callers", () => {
  const $ = load(renderToStaticMarkup(<ChecklistIndexPage config={ROBLOX_CHECKLISTS} cards={[]} total={0} totalPages={1} currentPage={1} showHero />));
  expect($(".content-sidebar-grid > aside#sidebar.space-y-4")).toHaveLength(1);
  expect($(".checklists-index-main")).toHaveLength(1);
});
