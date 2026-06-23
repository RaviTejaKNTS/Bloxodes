export function slugify(value: string) {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function statsUniverseSlug(value: string | null | undefined, universeId: number | string) {
  const id = String(universeId).trim();
  const base = slugify(value ?? "").replace(new RegExp(`-${id}$`), "");
  const prefix = base && base !== id ? base : "roblox-game";
  return `${prefix}-${id}`;
}

export const ROBLOX_ARTICLE_GAME_SLUG = "roblox";

export function articleGameSlugFromUniverse(universe: {
  universe_id?: number | string | null;
  slug?: string | null;
  display_name?: string | null;
  name?: string | null;
}) {
  const id = universe.universe_id == null ? "" : String(universe.universe_id).trim();
  const rawFallbackSlug = slugify(universe.slug ?? "");
  const fallbackSlug = id ? rawFallbackSlug.replace(new RegExp(`-${id}$`), "") : rawFallbackSlug;
  const base = slugify(universe.display_name ?? universe.name ?? "") || fallbackSlug;
  if (!base) return id ? `roblox-game-${id}` : "roblox-game";
  if (base === ROBLOX_ARTICLE_GAME_SLUG) return id ? `roblox-game-${id}` : "roblox-game";
  return base;
}

export function appendCodesSuffix(value: string) {
  const base = slugify(value);
  if (!base) return "";
  return base.endsWith("-codes") ? base : `${base}-codes`;
}

export function stripCodesSuffix(value: string) {
  return value.replace(/-codes$/i, "");
}

export function categorySlugFromGame(game: { name?: string | null; slug?: string | null }) {
  const nameSlug = game.name ? slugify(game.name) : "";
  const fallbackSlug = game.slug ? slugify(stripCodesSuffix(game.slug)) : "";
  const slug = nameSlug || fallbackSlug;
  return slug || null;
}

export function normalizeGameSlug(input?: string | null, fallback?: string | null) {
  const source = input?.trim() || fallback?.trim() || "";
  return appendCodesSuffix(source);
}

export function slugFromUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  try {
    const parsed = new URL(url);
    const parts = parsed.pathname.split("/").filter(Boolean);
    return parts.pop() ?? null;
  } catch {
    return null;
  }
}

export function titleizeGameSlug(slug: string) {
  const base = slug.replace(/-codes$/i, "");
  return base
    .split(/[-_]+/)
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

export function deriveGameName(opts: {
  name?: string | null;
  slug?: string | null;
  sourceUrl?: string | null;
}) {
  const trimmedName = opts.name?.trim();
  if (trimmedName) return trimmedName;

  const slugCandidate = opts.slug?.trim() || slugFromUrl(opts.sourceUrl) || "";
  const normalized = normalizeGameSlug(slugCandidate);
  if (!normalized) return "";
  return titleizeGameSlug(normalized);
}
