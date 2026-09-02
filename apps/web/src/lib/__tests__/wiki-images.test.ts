import { describe, expect, it } from "vitest";

import { resolveWikiCardImage, resolveWikiHeaderImage, resolveWikiMetadataImage } from "@/lib/wiki-images";

const page = {
  cover_image: "https://media.example/article-cover.webp",
  icon_url: "https://tr.rbxcdn.com/game-icon.png",
  thumbnail_urls: [{ url: "https://tr.rbxcdn.com/game-thumbnail.png" }],
};

describe("wiki image roles", () => {
  it("uses a landscape universe thumbnail for wiki cards", () => {
    expect(resolveWikiCardImage(page)).toBe("https://tr.rbxcdn.com/game-thumbnail.png");
  });

  it("uses the newest universe media icon for the square wiki header", () => {
    expect(
      resolveWikiHeaderImage(page, [
        { media_type: "icon", image_url: "https://tr.rbxcdn.com/latest-game-icon.png" },
        { media_type: "screenshot", image_url: "https://tr.rbxcdn.com/latest-game-thumbnail.png" },
      ])
    ).toBe("https://tr.rbxcdn.com/latest-game-icon.png");
  });

  it("uses the universe icon before a page cover when media history is unavailable", () => {
    expect(resolveWikiHeaderImage(page, [])).toBe("https://tr.rbxcdn.com/game-icon.png");
  });

  it("uses a landscape thumbnail for social previews", () => {
    expect(resolveWikiMetadataImage(page)).toBe("https://tr.rbxcdn.com/game-thumbnail.png");
  });

  it("keeps cover images only as a fallback", () => {
    const fallbackPage = { cover_image: "wiki/fallback.webp", icon_url: null, thumbnail_urls: null };
    expect(resolveWikiCardImage(fallbackPage)).toBe("/wiki/fallback.webp");
    expect(resolveWikiHeaderImage(fallbackPage, [])).toBe("/wiki/fallback.webp");
    expect(resolveWikiMetadataImage(fallbackPage)).toBe("/wiki/fallback.webp");
  });
});
