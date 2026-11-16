import { expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
vi.mock("@/lib/catalog", () => ({
  getCatalogPageContentByCodes: async () => null,
  getCatalogMembershipDate: async () => null
}));
vi.mock("@/lib/catalog-preview-data", () => ({ loadCatalogPreviewData: async () => ({ count: 100 }) }));
vi.mock("@/app/(site)/catalog/roblox-music-ids/page-data", () => ({
  getMusicChartConfig: (key: string) => ({
    title: `Chart ${key}`,
    path: `/catalog/roblox-music-ids/${key}`,
    description: `Songs for ${key}, with IDs ready to copy.`
  })
}));
import { buildMusicChartMetadata } from "../catalog/roblox-music-ids/chart-page";

it.each(["trending", "weekly", "monthly", "yearly"] as const)("keeps the %s description in document and social metadata", async key => {
  for (const page of [1, 2]) {
    const metadata = await buildMusicChartMetadata(key, page);
    expect(metadata.description).toBe(`Songs for ${key}, with IDs ready to copy.`);
    expect(metadata.openGraph?.description).toBe(metadata.description);
    expect(metadata.twitter?.description).toBe(metadata.description);
  }
});
