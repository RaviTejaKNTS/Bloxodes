import "server-only";
import { listPublishedWikiPages, type WikiListEntry } from "./wiki";
import { listPublishedWikiCollectionPages } from "./wiki-collections";
import { listGameCollectionImageUrls } from "./game-collection-images";
import { getStatsPlatformPage } from "./stats";
import { supabaseAdmin } from "./supabase";
import { selectWikiIndexPages, wikiIndexOptions, WIKI_PAGE_SIZE, type WikiSearchParams } from "./wiki-index-options";

export async function loadWikiIndexPageData(currentPage = 1, params: WikiSearchParams = {}) {
  const allPages = await listPublishedWikiPages();
  const options = wikiIndexOptions(params);
  const matching = selectWikiIndexPages(allPages, options);
  return {
    pages: matching.slice((currentPage - 1) * WIKI_PAGE_SIZE, currentPage * WIKI_PAGE_SIZE),
    total: matching.length,
    allPages,
    totalPages: Math.max(1, Math.ceil(matching.length / WIKI_PAGE_SIZE)),
    currentPage,
    options,
    genres: [...new Set(allPages.map((page) => page.universe_genre_l1).filter((genre): genre is string => Boolean(genre)))].sort()
  };
}

export type WikiIndexPageData = Awaited<ReturnType<typeof loadWikiIndexPageData>>;

async function loadFeaturedCollections(pages: WikiListEntry[]) {
  const slugs = new Set(pages.map((page) => page.slug));
  const collections = (await listPublishedWikiCollectionPages()).filter((page) => slugs.has(page.wiki_slug) && page.published_dataset_id);
  const featured = [];
  const seen = new Set<string>();
  for (const page of [...collections].sort((a, b) => (b.item_count ?? 0) - (a.item_count ?? 0))) {
    if (seen.has(page.wiki_slug)) continue;
    seen.add(page.wiki_slug);
    featured.push(page);
    if (featured.length === 4) break;
  }
  return Promise.all(featured.map(async (page) => ({
    page,
    images: await listGameCollectionImageUrls(page.code, 4).catch(() => page.thumb_url ? [page.thumb_url] : [])
  })));
}

type WikiEventRow = { event_id: string; universe_id: number; title: string | null; display_title: string | null; start_utc: string; end_utc: string; event_status: string | null };

async function loadWikiEvents(pages: WikiListEntry[]) {
  const ids = pages.map((page) => page.universe_id).filter((id): id is number => id != null);
  if (!ids.length) return [];
  const now = new Date().toISOString();
  const { data, error } = await supabaseAdmin().from("roblox_virtual_events")
    .select("event_id, universe_id, title, display_title, start_utc, end_utc, event_status")
    .in("universe_id", ids).gte("end_utc", now).not("start_utc", "is", null)
    .order("start_utc", { ascending: true }).limit(20);
  if (error) throw error;
  return (data as WikiEventRow[] ?? [])
    .filter((event) => !["cancelled", "canceled", "ended"].includes(event.event_status?.toLowerCase() ?? ""))
    .slice(0, 5)
    .map((event) => ({ ...event, wiki: pages.find((page) => page.universe_id === event.universe_id)! }));
}

export async function loadWikiOverview(pages: WikiListEntry[]) {
  const [activity, collections, events] = await Promise.allSettled([
    getStatsPlatformPage(), loadFeaturedCollections(pages), loadWikiEvents(pages)
  ]);
  for (const [name, result] of [["activity", activity], ["collections", collections], ["events", events]] as const) {
    if (result.status === "rejected") console.warn(`Wiki overview ${name} unavailable`, result.reason instanceof Error ? result.reason.message : "Data request failed");
  }
  return {
    activity: activity.status === "fulfilled" ? activity.value : null,
    collections: collections.status === "fulfilled" ? collections.value : [],
    events: events.status === "fulfilled" ? events.value : [],
    eventsAvailable: events.status === "fulfilled"
  };
}

export type WikiOverview = Awaited<ReturnType<typeof loadWikiOverview>>;
