import { beforeEach, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ catalog: vi.fn(), preview: vi.fn() }));
vi.mock("@/lib/catalog", () => ({ getCatalogPageContentByCodes: mocks.catalog }));
vi.mock("@/lib/catalog-preview-data", () => ({ loadCatalogPreviewData: mocks.preview }));
vi.mock("@/lib/seo", () => ({ SITE_URL: "https://bloxodes.com" }));
import { finalizeCatalogMetadata } from "../catalog-metadata";
import type { CatalogPageContent } from "../catalog";
beforeEach(() => {
  vi.clearAllMocks();
  mocks.catalog.mockResolvedValue({ code: "roblox-decal-ids", seo_title: "Saved title [1 image]" });
  mocks.preview.mockResolvedValue({ count: 38657 });
});
it("sets live counts and one cover for document, Open Graph and Twitter", async () => {
  const result = await finalizeCatalogMetadata({ title: "Roblox Decal IDs [24K+ Image Codes] (November 2026)", alternates: { canonical: "/catalog/roblox-decal-ids" } });
  expect(result.title).toBe("Roblox Decal IDs [38K+ Image Codes] (November 2026)");
  expect(result.openGraph?.title).toBe(result.title);
  expect(result.twitter?.title).toBe(result.title);
  expect(result.openGraph?.images).toEqual(["https://bloxodes.com/catalog-image/roblox-decal-ids.png"]);
  expect(result.twitter?.images).toEqual(result.openGraph?.images);
});
it.each(["Roblox Music IDs - Page 2", "Retail Tycoon 2 Music IDs - Page 2", "Roblox Decal IDs [24K+ Image Codes] - Page 2"])("preserves route pagination wording: %s", async title => {
  const result = await finalizeCatalogMetadata({ title, alternates: { canonical: "/catalog/roblox-music-ids/page/2" } });
  expect(result.title).toBe(title.replace("24K+", "38K+"));
});
it("uses the existing live avatar count on page two without another reader", async () => {
  const result = await finalizeCatalogMetadata({ title: "Roblox Item Codes [91K+ Item IDs] - Page 2", alternates: { canonical: "/catalog/roblox-items-and-bundles/page/2" } }, { catalog: null, count: 105999 });
  expect(result.title).toBe("Roblox Item Codes [105K+ Item IDs] - Page 2");
  expect(mocks.catalog).not.toHaveBeenCalled();
  expect(mocks.preview).not.toHaveBeenCalled();
});
it("honors a resolved legacy row and saved cover without another catalog query", async () => {
  const catalog = { code: "roblox-free-items", thumb_url: "https://media.bloxodes.com/saved.png" } as CatalogPageContent;
  const result = await finalizeCatalogMetadata({ title: "Free items (150 items)", alternates: { canonical: "/catalog/free-roblox-items" } }, { catalog });
  expect(result.openGraph?.images).toEqual([catalog.thumb_url]);
  expect(mocks.catalog).not.toHaveBeenCalled();
});
