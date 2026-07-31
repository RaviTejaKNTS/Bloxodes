const PUBLIC_STORAGE_PATH = "/storage/v1/object/public/";

export const LEGACY_MANAGED_SUPABASE_ORIGIN = "https://bmwksaykcsndsvgspapz.supabase.co";
export const CURRENT_SUPABASE_API_ORIGIN = "https://database.bloxodes.com";
export const CANONICAL_MEDIA_ORIGIN = "https://media.bloxodes.com";

const LEGACY_MANAGED_MEDIA_PATTERN =
  /https:\/\/bmwksaykcsndsvgspapz\.supabase\.co\/storage\/v1\/object\/public\/[^\s)'"<>\\]+/gi;
const NON_CANONICAL_MEDIA_PATTERN =
  /https:\/\/(?:bmwksaykcsndsvgspapz\.supabase\.co|database\.bloxodes\.com)\/storage\/v1\/object\/public\/[^\s)'"<>\\]+/gi;

function uniqueMatchedUrls(value: unknown, pattern: RegExp): string[] {
  const serialized = typeof value === "string" ? value : JSON.stringify(value);
  if (!serialized) return [];

  pattern.lastIndex = 0;
  return Array.from(
    new Set(
      Array.from(serialized.matchAll(pattern), (match) => match[0].replace(/[.,;:!?]+$/, ""))
    )
  );
}

export function findLegacyManagedMediaUrls(value: unknown): string[] {
  return uniqueMatchedUrls(value, LEGACY_MANAGED_MEDIA_PATTERN);
}

export function findNonCanonicalMediaUrls(value: unknown): string[] {
  return uniqueMatchedUrls(value, NON_CANONICAL_MEDIA_PATTERN);
}

export function assertCanonicalMediaUrls(value: unknown, label: string): void {
  const urls = findNonCanonicalMediaUrls(value);
  if (!urls.length) return;

  throw new Error(
    `${label} contains ${urls.length} non-canonical Supabase media URL${urls.length === 1 ? "" : "s"}. ` +
      `Use ${CANONICAL_MEDIA_ORIGIN} for public Storage objects.`
  );
}

export const assertNoLegacyManagedMedia = assertCanonicalMediaUrls;

export function toMediaPublicUrl(publicUrl: string | null | undefined): string | null {
  if (!publicUrl) return null;

  try {
    const url = new URL(publicUrl);
    const storagePathIndex = url.pathname.indexOf(PUBLIC_STORAGE_PATH);
    if (storagePathIndex === -1) return publicUrl;

    const configured = process.env.SUPABASE_MEDIA_PUBLIC_URL?.trim().replace(/\/+$/, "");
    let mediaBase = configured;
    if (configured) {
      const configuredUrl = new URL(configured);
      if (
        configuredUrl.origin === CURRENT_SUPABASE_API_ORIGIN ||
        configuredUrl.origin === LEGACY_MANAGED_SUPABASE_ORIGIN
      ) {
        mediaBase = CANONICAL_MEDIA_ORIGIN;
      }
    } else if (
      url.origin === CURRENT_SUPABASE_API_ORIGIN ||
      url.origin === LEGACY_MANAGED_SUPABASE_ORIGIN
    ) {
      mediaBase = CANONICAL_MEDIA_ORIGIN;
    }
    if (!mediaBase) return publicUrl;

    const mediaUrl = new URL(mediaBase);
    mediaUrl.pathname = url.pathname;
    mediaUrl.search = url.search;
    mediaUrl.hash = url.hash;
    return mediaUrl.toString();
  } catch {
    return publicUrl;
  }
}
