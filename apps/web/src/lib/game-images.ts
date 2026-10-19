/** Shared non-Roblox image roles. games.hero_image is the square title artwork. */
export type GameImageFields = {
  cover_image?: string | null;
  thumb_url?: string | null;
  image?: string | null;
  game_cover_image?: string | null;
  game_hero_image?: string | null;
};

export function gameImageUrl(value: unknown): string | null {
  if (typeof value !== "string" || !value.trim()) return null;
  const image = value.trim();
  if ((!image.startsWith("https://") && !/^\/(?!\/)/.test(image)) || /[\s\\]/.test(image)) return null;
  try {
    const url = new URL(image, "https://bloxodes.com");
    if (url.protocol !== "https:" || url.username || url.password || /\/Bloxodes(?:-(?:dark|light))?\.(png|webp|svg)$/i.test(url.pathname)) return null;
    return image.startsWith("/") && !image.startsWith("//") ? image : url.href;
  } catch { return null; }
}

export function resolveGameCoverImage(page: GameImageFields): string | null {
  return gameImageUrl(page.cover_image) || gameImageUrl(page.thumb_url) || gameImageUrl(page.image) || gameImageUrl(page.game_cover_image);
}

export function resolveGameThumbnailImage(page: GameImageFields): string | null {
  return gameImageUrl(page.game_hero_image);
}
