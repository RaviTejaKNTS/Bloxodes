import { describe, expect, it, vi } from "vitest";
import { catalogImageType, resolveCatalogImage } from "../catalog-image";

vi.mock("@/lib/seo", () => ({ SITE_URL: "https://bloxodes.com" }));

describe("catalog covers", () => {
  it("keeps saved thumbnails", () => {
    expect(resolveCatalogImage({ code: "roblox-decal-ids", thumb_url: "https://example.com/exact.png" })).toBe("https://example.com/exact.png");
  });
  it("uses a cacheable generated URL when artwork is empty", () => {
    expect(resolveCatalogImage({ code: "roblox-music-ids", thumb_url: " " })).toBe("https://bloxodes.com/catalog-image/roblox-music-ids.png");
  });
  it("selects official game art for both game families", () => {
    expect(catalogImageType("roblox-music-ids/games/3008")).toBe("game");
    expect(catalogImageType("roblox-decal-ids/games/bloxburg")).toBe("game");
    expect(catalogImageType("roblox-items-and-bundles/roblox-emotes")).toBe("items");
    expect(catalogImageType("roblox-font-ids")).toBe("title");
  });
});

it("shares legacy free-item candidate order at every depth", async () => {
  const { catalogCodeCandidates } = await import("../catalog-code-candidates");
  expect(catalogCodeCandidates("free-roblox-items/hats")).toEqual(["free-roblox-items/hats", "roblox-free-items/hats"]);
  expect(catalogCodeCandidates("roblox-free-items/hats")).toEqual(["free-roblox-items/hats", "roblox-free-items/hats"]);
});
