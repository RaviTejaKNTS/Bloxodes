const WIKI_MEDIA_BASE_URL = "https://media.bloxodes.com/wiki";

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
