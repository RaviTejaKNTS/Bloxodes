import { cleanRobloxUniverseDisplayName } from "@/lib/roblox/display-name";
import { slugify } from "@/lib/slug";

export function isPlaceholderGameDetail(game: { id?: unknown; name?: unknown; rootPlaceId?: unknown }) {
  return game.id === 0 || game.rootPlaceId === 0 ||
    (typeof game.name === "string" && game.name.trim().toUpperCase() === "[TITLE UNAVAILABLE]");
}

export function hasPlaceholderUniverseIdentity(row: { name?: unknown; slug?: unknown }) {
  return isPlaceholderGameDetail({ name: row.name }) || row.slug === "title-unavailable";
}

export function repairedUniverseIdentity(game: { id: number; name?: string; rootPlaceId?: number }, universeId: number) {
  if (game.id !== universeId || isPlaceholderGameDetail(game) ||
      !Number.isSafeInteger(game.rootPlaceId) || Number(game.rootPlaceId) <= 0 || !game.name?.trim()) return null;
  return { root_place_id: game.rootPlaceId!, ...universeNameFields(universeId, game.name) };
}

export function universeNameFields(universeId: number, name: string) {
  const displayName = cleanRobloxUniverseDisplayName(name);
  return {
    name,
    display_name: displayName,
    slug: slugify(displayName ?? name) || `universe-${universeId}`
  };
}
