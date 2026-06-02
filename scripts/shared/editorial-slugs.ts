import { slugify } from "@/lib/slug";

const TRAILING_UNIVERSE_ID_PATTERN = /-\d{6,}$/;

type SlugGuardOptions = {
  matchAnyTrailingId?: boolean;
};

export function isLikelyUniverseStatsSlug(
  value: string | null | undefined,
  universeId?: number | null,
  options: SlugGuardOptions = {}
) {
  const slug = slugify(value ?? "");
  if (!slug) return false;
  if (typeof universeId === "number" && Number.isFinite(universeId) && slug.endsWith(`-${universeId}`)) {
    return true;
  }
  if (options.matchAnyTrailingId === false) return false;
  return TRAILING_UNIVERSE_ID_PATTERN.test(slug);
}

export function assertEditorialSlug(
  value: string | null | undefined,
  fieldName: string,
  universeId?: number | null,
  options?: SlugGuardOptions
) {
  if (!isLikelyUniverseStatsSlug(value, universeId, options)) return;
  throw new Error(
    `${fieldName} looks like a stats universe slug (${value}). Use the editorial game/page slug instead; roblox_universes.slug is for /stats/games only.`
  );
}
