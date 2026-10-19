import { describe, expect, it } from "vitest";
import { gameImageUrl, resolveGameCoverImage, resolveGameThumbnailImage } from "../game-images";

describe("franchise artwork roles", () => {
  const artwork = { game_cover_image: "https://media.bloxodes.com/cover.webp", game_hero_image: "https://media.bloxodes.com/square.webp" };
  it("keeps landscape metadata and square title artwork separate", () => {
    expect(resolveGameCoverImage(artwork)).toBe(artwork.game_cover_image);
    expect(resolveGameThumbnailImage(artwork)).toBe(artwork.game_hero_image);
    expect(resolveGameThumbnailImage({ game_cover_image: artwork.game_cover_image })).toBeNull();
    expect(resolveGameCoverImage({ game_hero_image: artwork.game_hero_image })).toBeNull();
  });
  it("prefers page artwork and falls back to the owning game", () => {
    expect(resolveGameCoverImage({ ...artwork, thumb_url: "/images/tools/example.webp" })).toBe("/images/tools/example.webp");
    expect(resolveGameCoverImage({ ...artwork, cover_image: " ", image: "/Bloxodes.png" })).toBe(artwork.game_cover_image);
  });
  it("never treats the site logo or unsafe input as game artwork", () => {
    for (const image of ["/Bloxodes.png", "https://bloxodes.com/Bloxodes.png?v=1", "//example.com/a.webp", "javascript:alert(1)", "https://user:secret@example.com/a.webp", "unknown.webp", " /\\example.com/a.webp "]) expect(gameImageUrl(image)).toBeNull();
    expect(resolveGameCoverImage({})).toBeNull();
  });
});
