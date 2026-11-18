/** Public origin of the `bloxodes-wiki` R2 bucket (R2 custom domain; the bucket root is the host root). */
export const WIKI_MEDIA_BASE_URL = "https://wiki-media.bloxodes.com";
export const WIKI_MEDIA_HOSTNAME = "wiki-media.bloxodes.com";
/**
 * Retired Worker route. Stored rows, immutable revisions and older Content Factory
 * bundles may still carry it; a Cloudflare redirect keeps it working, but code
 * rewrites it to WIKI_MEDIA_BASE_URL so pages never depend on the redirect.
 */
export const LEGACY_WIKI_MEDIA_BASE_URL = "https://media.bloxodes.com/wiki";

const LEGACY_PREFIX = `${LEGACY_WIKI_MEDIA_BASE_URL}/`;
const CURRENT_PREFIX = `${WIKI_MEDIA_BASE_URL}/`;

function normalizeBaseUrl(value: string): string {
  return value.trim().replace(/\/+$/, "");
}

export function wikiMediaPublicBaseUrl(): string {
  const configured = process.env.WIKI_MEDIA_PUBLIC_BASE_URL?.trim();
  if (configured) return normalizeBaseUrl(configured);
  return WIKI_MEDIA_BASE_URL;
}

export function normalizeWikiMediaKey(value: string): string {
  const normalized = value
    .trim()
    .replace(/^\/+/, "")
    .split("/")
    .map((segment) => decodeURIComponent(segment))
    .join("/");

  if (
    !normalized ||
    normalized.includes("\\") ||
    normalized.includes("\0") ||
    normalized.split("/").some((segment) => !segment || segment === "." || segment === "..")
  ) {
    throw new Error(`Invalid wiki media key: ${value}`);
  }

  return normalized;
}

export function resolveWikiMediaUrl(key: string | null | undefined): string | null {
  if (!key?.trim()) return null;
  const encodedKey = normalizeWikiMediaKey(key)
    .split("/")
    .map((segment) => encodeURIComponent(segment))
    .join("/");
  return `${wikiMediaPublicBaseUrl()}/${encodedKey}`;
}

/** Canonical stored URL for an R2 key, exactly as publishers write it (key is not re-encoded). */
export function wikiMediaUrl(key: string): string {
  return `${CURRENT_PREFIX}${key}`;
}

/** The R2 key behind a current or legacy wiki media URL, or null for any other URL. */
export function wikiMediaKeyFromUrl(value: string | null | undefined): string | null {
  if (typeof value !== "string") return null;
  const prefix = [CURRENT_PREFIX, LEGACY_PREFIX].find((candidate) => value.startsWith(candidate));
  const key = prefix ? value.slice(prefix.length) : "";
  return key ? key : null;
}

export function isWikiMediaUrl(value: string | null | undefined): boolean {
  return wikiMediaKeyFromUrl(value) !== null;
}

/** Rewrite every legacy wiki media prefix in a string (a URL, Markdown or serialized JSON). */
export function rewriteLegacyWikiMediaUrls<T extends string | null | undefined>(value: T): T {
  if (typeof value !== "string" || !value.includes(LEGACY_PREFIX)) return value;
  return value.replaceAll(LEGACY_PREFIX, CURRENT_PREFIX) as T;
}

/** Rewrite legacy wiki media prefixes in every string inside a JSON-like value. Unchanged values keep their identity. */
export function rewriteLegacyWikiMediaUrlsDeep<T>(value: T): T {
  if (typeof value === "string") return rewriteLegacyWikiMediaUrls(value) as T;
  if (Array.isArray(value)) {
    let changed = false;
    const next = value.map((entry) => {
      const rewritten = rewriteLegacyWikiMediaUrlsDeep(entry);
      if (rewritten !== entry) changed = true;
      return rewritten;
    });
    return (changed ? next : value) as T;
  }
  if (value && typeof value === "object" && Object.getPrototypeOf(value) === Object.prototype) {
    let changed = false;
    const next: Record<string, unknown> = {};
    for (const [key, entry] of Object.entries(value as Record<string, unknown>)) {
      const rewritten = rewriteLegacyWikiMediaUrlsDeep(entry);
      if (rewritten !== entry) changed = true;
      next[key] = rewritten;
    }
    return (changed ? next : value) as T;
  }
  return value;
}
