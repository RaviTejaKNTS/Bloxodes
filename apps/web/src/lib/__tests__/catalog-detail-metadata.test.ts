import { beforeEach, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ catalog: vi.fn() }));
vi.mock("@/lib/catalog", () => ({ getCatalogPageContentByCodes: mocks.catalog }));
vi.mock("@/lib/catalog-preview-data", () => ({ loadCatalogPreviewData: async () => ({}) }));
vi.mock("@/app/(site)/catalog/roblox-music-ids/page-data", () => ({ BASE_PATH: "/catalog/roblox-music-ids" }));
vi.mock("@/components/IndexPageStats", () => ({ IndexPageStats: () => null }));
vi.mock("@/components/PagePagination", () => ({ PagePagination: () => null }));
import { generateMetadata as artistMetadata } from "@/app/(site)/catalog/roblox-music-ids/artists/[artist]/page";
import { generateMetadata as genreMetadata } from "@/app/(site)/catalog/roblox-music-ids/genres/[genre]/page";

beforeEach(() => { vi.clearAllMocks(); mocks.catalog.mockResolvedValue(null); });
it("the artist caller supplies its route and receives catalog artwork", async () => {
  const result = await artistMetadata({ params: Promise.resolve({ artist: "test-artist" }) });
  expect(mocks.catalog).toHaveBeenCalledWith(["roblox-music-ids/artists/test-artist"]);
  expect(result.openGraph?.images).toEqual([expect.stringContaining("/catalog-image/roblox-music-ids.png")]);
  expect(result.twitter?.images).toEqual(result.openGraph?.images);
});
it("the genre caller honors a saved cover on its real route", async () => {
  mocks.catalog.mockResolvedValue({ code: "roblox-music-ids/genres/pop", thumb_url: "https://media.bloxodes.com/pop.png" });
  const result = await genreMetadata({ params: Promise.resolve({ genre: "pop" }) });
  expect(mocks.catalog).toHaveBeenCalledWith(["roblox-music-ids/genres/pop"]);
  expect(result.openGraph?.images).toEqual(["https://media.bloxodes.com/pop.png"]);
  expect(result.twitter?.images).toEqual(result.openGraph?.images);
});

it.each(["a#b", "a?b", "a%b"])("the artist caller looks up the complete decoded segment %s", async artist => {
  const code = `roblox-music-ids/artists/${artist}`;
  mocks.catalog.mockImplementation(async (codes: string[]) => codes.includes(code)
    ? { code, thumb_url: "https://media.bloxodes.com/artist.png" }
    : null);
  const result = await artistMetadata({ params: Promise.resolve({ artist }) });
  expect(mocks.catalog).toHaveBeenCalledWith([code]);
  expect(result.openGraph?.images).toEqual(["https://media.bloxodes.com/artist.png"]);
  expect(result.twitter?.images).toEqual(result.openGraph?.images);
});

it.each(["a#b", "a?b", "a%b"])("the genre caller looks up the complete decoded segment %s", async genre => {
  const code = `roblox-music-ids/genres/${genre}`;
  mocks.catalog.mockImplementation(async (codes: string[]) => codes.includes(code)
    ? { code, thumb_url: "https://media.bloxodes.com/genre.png" }
    : null);
  const result = await genreMetadata({ params: Promise.resolve({ genre }) });
  expect(mocks.catalog).toHaveBeenCalledWith([code]);
  expect(result.openGraph?.images).toEqual(["https://media.bloxodes.com/genre.png"]);
  expect(result.twitter?.images).toEqual(result.openGraph?.images);
});
