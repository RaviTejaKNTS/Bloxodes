import "server-only";
import { supabaseAdmin } from "./supabase";
import { withSiteUrl, type SitemapUrlSetEntry } from "./sitemap";

// Temporary recrawl aid: remove this sitemap and its index entry on this date.
export const MOVED_GAME_SITEMAP_REMOVE_ON = "2027-01-02";
const PAGE_SIZE = 500;

export async function movedGameSitemapEntries(): Promise<SitemapUrlSetEntry[]> {
  const entries: SitemapUrlSetEntry[] = [];
  const client = supabaseAdmin();
  // Keyset pages on path, so a row changing mid-read can't shift a page boundary.
  for (let after: string | null = null; ; ) {
    let query = client.from("site_routes").select("path")
      .eq("status", "old").eq("source", "game").not("page_id", "is", null)
      .order("path").limit(PAGE_SIZE);
    if (after) query = query.gt("path", after);
    const { data, error } = await query;
    if (error || !data) throw new Error("Moved game sitemap unavailable");
    entries.push(...data.map(({ path }) => ({ loc: withSiteUrl(path), changefreq: "monthly", priority: "0.1" })));
    if (data.length < PAGE_SIZE) return entries;
    after = data[data.length - 1].path;
  }
}
