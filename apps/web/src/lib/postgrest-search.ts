/**
 * Quote an already-built LIKE pattern for a PostgREST .or() logic tree.
 * Escape literal LIKE characters (% _ \) before calling this helper; loose
 * patterns can keep their intentional wildcards. The logic parser consumes
 * one backslash escape layer, leaving the original pattern for PostgreSQL.
 * Do not use this for direct .ilike() parameters or URL-encode it here.
 */
export function quotePostgrestPattern(pattern: string): string {
  return `"${pattern.replace(/["\\]/g, (char) => `\\${char}`)}"`;
}
