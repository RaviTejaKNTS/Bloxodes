// Plain-Node copy of the wiki media hosts in apps/web/src/lib/wiki-media.ts, for
// .mjs CI contracts that cannot import TypeScript. A parity test keeps them equal.
export const WIKI_MEDIA_BASE_URL = 'https://wiki-media.bloxodes.com';
export const WIKI_MEDIA_HOSTNAME = 'wiki-media.bloxodes.com';
// Retired Worker route; a Cloudflare redirect keeps it working for old links.
export const LEGACY_WIKI_MEDIA_BASE_URL = 'https://media.bloxodes.com/wiki';

/** Rewrite a retired `https://media.bloxodes.com/wiki/<key>` URL to the R2 custom domain. Other values are unchanged. */
export function rewriteLegacyWikiMediaUrl(value) {
  const legacy = `${LEGACY_WIKI_MEDIA_BASE_URL}/`;
  return typeof value === 'string' && value.startsWith(legacy) ? `${WIKI_MEDIA_BASE_URL}/${value.slice(legacy.length)}` : value;
}
