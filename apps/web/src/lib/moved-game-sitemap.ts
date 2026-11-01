import "server-only";
import { supabaseAdmin } from "./supabase";
import { withSiteUrl, type SitemapUrlSetEntry } from "./sitemap";

// Temporary recrawl aid: remove this sitemap and its index entry on this date.
export const MOVED_GAME_SITEMAP_REMOVE_ON = "2027-01-02";
const PAGE_SIZE = 500;

export async function movedGameSitemapEntries(): Promise<SitemapUrlSetEntry[]> {
  const entries: SitemapUrlSetEntry[] = [];
  const client = supabaseAdmin();
  for (let offset = 0; ; offset += PAGE_SIZE) {
    const { data, error } = await client.from("site_routes").select("path")
      .eq("status", "old").eq("source", "game").not("page_id", "is", null)
      .order("path").range(offset, offset + PAGE_SIZE - 1);
    if (error || !data) throw new Error("Moved game sitemap unavailable");
    entries.push(...data.map(({ path }) => ({ loc: withSiteUrl(path), changefreq: "monthly", priority: "0.1" })));
    if (data.length < PAGE_SIZE) return entries;
  }
}
