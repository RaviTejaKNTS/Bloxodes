import { load } from "cheerio";

export type SeenEntry = { attempts: number; done?: string; error?: string };
export type DiscoveryState = { version: 1; robloxdenBaseline: boolean; entries: Record<string, SeenEntry> };
export const emptyState = (): DiscoveryState => ({ version: 1, robloxdenBaseline: false, entries: {} });
export function sitemapSlugs(xml: string): string[] {
  const $ = load(xml, { xmlMode: true });
  const slugs = new Set<string>();
  $("url > loc").each((_, node) => {
    try {
      const url = new URL($(node).text());
      const match = /^\/game-codes\/([a-z0-9-]+)\/?$/.exec(url.pathname);
      if (url.hostname === "robloxden.com" && match && !["genres", "categories"].includes(match[1])) slugs.add(match[1]);
    } catch { /* Invalid sitemap entry. */ }
  });
  return [...slugs];
}
export function titleToName(title: string): string {
  return title.replace(/\s*\|\s*Roblox\s*Den.*$/i, "").replace(/\s+[-–|]\s+Beebom.*$/i, "").replace(/\s+Codes\b.*$/i, "").replace(/^Roblox\s+/i, "").trim();
}
export const normalizeName = (name: string) => name.normalize("NFKC").toLowerCase().replace(/[^\p{L}\p{N}]+/gu, " ").trim();
export function resolveName(name: string, rows: Array<{ universe_id: number; name: string | null; display_name?: string | null; root_place_id: number | null }>) {
  const key = normalizeName(name);
  const matches = rows.filter(row => [row.name, row.display_name].some(value => value && normalizeName(value) === key));
  const unique = new Map(matches.map(row => [row.universe_id, row]));
  return unique.size === 1 ? [...unique.values()][0] : null;
}
export function pendingKeys(keys: string[], state: DiscoveryState) { return keys.filter(key => !state.entries[key]?.done); }
export function recordAttempt(state: DiscoveryState, key: string, error: string, cap = 5) {
  const entry = state.entries[key] ?? { attempts: 0 };
  entry.attempts += 1; entry.error = error;
  if (entry.attempts >= cap) entry.done = `given-up: ${error}`;
  state.entries[key] = entry;
  return entry;
}
export function queueDecision(existing: { is_published: boolean } | null, queued: { status: string; urls: string[] } | null, url: string) {
  if (existing) return existing.is_published ? "existing-published" : "existing-unpublished";
  if (queued) return queued.status === "New" && !queued.urls.includes(url) ? "merge" : "already-queued";
  return "create";
}
export function beebomArticles(html: string): string[] {
  const $ = load(html); const urls = new Set<string>();
  $("a[href]").each((_, node) => {
    try {
      const url = new URL($(node).attr("href")!, "https://beebom.com");
      if (url.hostname === "beebom.com" && /^\/[^/]+-codes\/?$/.test(url.pathname)) urls.add(`https://beebom.com${url.pathname}`);
    } catch { /* Invalid anchor. */ }
  });
  return [...urls];
}
export function robloxPlaceIds(html: string): number[] {
  return [...new Set([...html.replace(/\\\//g, "/").matchAll(/https?:\/\/(?:www\.)?roblox\.com\/games\/(\d+)/gi)].map(match => Number(match[1])))];
}

export function initializeRobloxdenBaseline(state: DiscoveryState, slugs: string[]): boolean {
  if (state.robloxdenBaseline) return false;
  for (const slug of slugs) state.entries[`den:${slug}`] = { attempts: 0, done: "initial-baseline" };
  state.robloxdenBaseline = true;
  return true;
}
