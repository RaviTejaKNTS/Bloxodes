const DEFAULT_SITE_URL = "https://bloxodes.com";
const INDEXABLE_HOSTS = new Set(["bloxodes.com", "www.bloxodes.com"]);

export function normalizeOrigin(value: string | undefined): string | null {
  if (!value) return null;
  const trimmed = value.trim();
  if (!trimmed) return null;

  try {
    const parsed = new URL(trimmed);
    if (parsed.protocol !== "https:" && parsed.protocol !== "http:") return null;
    return `${parsed.protocol}//${parsed.host}`;
  } catch {
    return null;
  }
}

export function isSearchIndexingEnabledForHost(hostname: string | null | undefined) {
  if (!hostname) return false;
  return INDEXABLE_HOSTS.has(hostname.trim().toLowerCase());
}

function resolveSiteUrl() {
  return normalizeOrigin(process.env.SITE_URL ?? process.env.NEXT_PUBLIC_SITE_URL) ?? DEFAULT_SITE_URL;
}

export const SITE_URL = resolveSiteUrl();
export const SITE_HOST = new URL(SITE_URL).hostname.toLowerCase();
export const SEARCH_INDEXING_ENABLED = isSearchIndexingEnabledForHost(SITE_HOST);
