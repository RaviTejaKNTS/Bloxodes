import type { WikiListEntry } from "./wiki";
import { currentPlayingValue } from "./stats-freshness";

export const WIKI_PAGE_SIZE = 20;
export type WikiSearchParams = Record<string, string | string[] | undefined>;
export type WikiIndexOptions = { q: string; genre: string; sort: "updated" | "name" | "players" };

export function wikiIndexOptions(params: WikiSearchParams = {}): WikiIndexOptions {
  const value = (key: string) => (typeof params[key] === "string" ? params[key] : "").trim();
  const sort = value("sort");
  return { q: value("q").slice(0, 100), genre: value("genre").slice(0, 80), sort: sort === "name" || sort === "players" ? sort : "updated" };
}

export function wikiIndexQuery(options: WikiIndexOptions) {
  const params = new URLSearchParams();
  if (options.q) params.set("q", options.q);
  if (options.genre) params.set("genre", options.genre);
  if (options.sort !== "updated") params.set("sort", options.sort);
  return params.toString();
}

export function selectWikiIndexPages(pages: WikiListEntry[], options: WikiIndexOptions, now = Date.now()) {
  const query = options.q.toLocaleLowerCase("en-US");
  const title = (page: WikiListEntry) => page.title.replace(/\s+wiki$/i, "");
  const date = (page: WikiListEntry) => Date.parse(page.content_updated_at ?? page.updated_at ?? page.published_at ?? page.created_at ?? "") || 0;
  const players = (page: WikiListEntry) => currentPlayingValue(page.playing, page.last_playing_refreshed_at, now) ?? -1;
  return pages.filter((page) => (!query || title(page).toLocaleLowerCase("en-US").includes(query)) && (!options.genre || page.universe_genre_l1 === options.genre))
    .sort((a, b) => {
      const order = options.sort === "name" ? title(a).localeCompare(title(b)) : options.sort === "players" ? players(b) - players(a) : date(b) - date(a);
      return order || a.id.localeCompare(b.id);
    });
}
