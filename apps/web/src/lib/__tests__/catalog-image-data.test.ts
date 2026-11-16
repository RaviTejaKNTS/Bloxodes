import { expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ single: vi.fn() }));
vi.mock("@/lib/catalog-preview-data", () => ({ loadCatalogPreviewData: async () => ({ count: 32 }) }));
vi.mock("@/lib/supabase", () => ({ supabaseAdmin: () => ({ from: () => ({ select: () => ({ eq: () => ({ maybeSingle: mocks.single }) }) }) }) }));
import { loadCatalogImageData } from "../catalog-image-data";
import type { CatalogPageContent } from "../catalog";

it("selects the owning universe's first official thumbnail", async () => {
  mocks.single.mockResolvedValue({ data: { thumbnail_urls: [{ url: "https://tr.rbxcdn.com/exact-game.png" }] }, error: null });
  const page = { code: "roblox-music-ids/games/3008", universe_id: 100 } as CatalogPageContent;
  expect(await loadCatalogImageData(page)).toMatchObject({ type: "game", background: "https://tr.rbxcdn.com/exact-game.png" });
});

it("throws when the official universe thumbnail read fails", async () => {
  mocks.single.mockResolvedValue({ data: null, error: new Error("universe database unavailable") });
  const page = { code: "roblox-decal-ids/games/bloxburg", universe_id: 100 } as CatalogPageContent;
  await expect(loadCatalogImageData(page)).rejects.toThrow("universe database unavailable");
});
